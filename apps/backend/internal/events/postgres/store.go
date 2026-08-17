// Package postgres is the Postgres-backed implementation of the domain event
// outbox and its per-consumer delivery ledger.
package postgres

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tiredbooy/internal/events"
)

// Store implements events.Store over the main database.
type Store struct {
	db *pgxpool.Pool
}

// NewStore builds a store over the main pool.
func NewStore(db *pgxpool.Pool) *Store { return &Store{db: db} }

var _ events.Store = (*Store)(nil)

const insertEventSQL = `
	INSERT INTO domain_events (
		event_id, type, source, subject, partition_key, spec_version,
		occurred_at, data, correlation_id, causation_id, traceparent,
		idempotency_key
	)
	VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, $12)
	ON CONFLICT (idempotency_key) DO NOTHING`

func insertArgs(env *events.Envelope) []any {
	return []any{
		env.ID, env.Type, env.Source, env.Subject, env.PartitionKey(),
		env.SpecVersion, env.Time, []byte(env.Data),
		nullIfEmpty(env.Rumera.CorrelationID),
		nullIfEmpty(env.Rumera.CausationID),
		nullIfEmpty(env.Rumera.Traceparent),
		env.Rumera.IdempotencyKey,
	}
}

// EnqueueTx writes the fact on the caller's transaction. This is the method
// that makes the outbox transactional — the fact commits with the money or not
// at all.
func (s *Store) EnqueueTx(ctx context.Context, tx pgx.Tx, env *events.Envelope) error {
	if tx == nil {
		return fmt.Errorf("events: EnqueueTx requires an open transaction")
	}
	if env == nil {
		return fmt.Errorf("events: EnqueueTx requires an envelope")
	}
	if _, err := tx.Exec(ctx, insertEventSQL, insertArgs(env)...); err != nil {
		return fmt.Errorf("events enqueue tx %s: %w", env.Type, err)
	}
	return nil
}

// Enqueue writes the fact on the pool. Only for facts with no domain
// transaction to ride.
func (s *Store) Enqueue(ctx context.Context, env *events.Envelope) error {
	if env == nil {
		return fmt.Errorf("events: Enqueue requires an envelope")
	}
	if _, err := s.db.Exec(ctx, insertEventSQL, insertArgs(env)...); err != nil {
		return fmt.Errorf("events enqueue %s: %w", env.Type, err)
	}
	return nil
}

// ClaimUnpublished locks a batch of facts awaiting relay to Kafka.
//
// The lock matters: without SKIP LOCKED two relay replicas publish the same row
// twice. The CTE claims and stamps publish_attempts in one statement so a
// crashed relay cannot leave a row claimed forever.
func (s *Store) ClaimUnpublished(ctx context.Context, limit int) ([]events.Row, error) {
	if limit <= 0 {
		limit = 100
	}
	const q = `
		WITH claimed AS (
			SELECT id
			FROM domain_events
			WHERE published_at IS NULL AND publish_after <= NOW()
			ORDER BY publish_after ASC, id ASC
			LIMIT $1
			FOR UPDATE SKIP LOCKED
		)
		UPDATE domain_events e
		SET publish_attempts = e.publish_attempts + 1
		FROM claimed c
		WHERE e.id = c.id
		RETURNING e.id, e.event_id, e.type, e.source, e.subject, e.partition_key,
		          e.spec_version, e.occurred_at, e.data, e.correlation_id,
		          e.causation_id, e.traceparent, e.idempotency_key,
		          e.publish_attempts`
	rows, err := s.db.Query(ctx, q, limit)
	if err != nil {
		return nil, fmt.Errorf("events claim unpublished: %w", err)
	}
	defer rows.Close()

	var out []events.Row
	for rows.Next() {
		row, err := scanRow(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, row)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("events claim unpublished: %w", err)
	}
	return out, nil
}

// MarkPublished records a successful produce. The published_at IS NULL guard
// keeps a late duplicate from resurrecting the row.
func (s *Store) MarkPublished(ctx context.Context, pk int64) error {
	const q = `
		UPDATE domain_events
		SET published_at = NOW(), publish_error = NULL
		WHERE id = $1 AND published_at IS NULL`
	if _, err := s.db.Exec(ctx, q, pk); err != nil {
		return fmt.Errorf("events mark published: %w", err)
	}
	return nil
}

// MarkPublishError backs the row off. Without publish_after a failing row stays
// eligible on every tick and starves the batch.
func (s *Store) MarkPublishError(ctx context.Context, pk int64, errMsg string, retryAfter time.Time) error {
	const q = `
		UPDATE domain_events
		SET publish_error = $2, publish_after = $3
		WHERE id = $1 AND published_at IS NULL`
	if _, err := s.db.Exec(ctx, q, pk, truncate(errMsg, 1000), retryAfter); err != nil {
		return fmt.Errorf("events mark publish error: %w", err)
	}
	return nil
}

// FanOut creates pending consumption rows for facts that have none yet.
//
// Runs in one transaction per batch so a fact is never half fanned out: either
// every matching consumer has a row and dispatched_at is set, or neither.
func (s *Store) FanOut(ctx context.Context, consumers []events.ConsumerBinding, limit int, minAge time.Duration) (int, error) {
	if len(consumers) == 0 {
		return 0, nil
	}
	if limit <= 0 {
		limit = 100
	}
	if minAge < 0 {
		minAge = 0
	}
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return 0, fmt.Errorf("events fan-out begin: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	// dispatched_at IS NULL is the whole gate: the Kafka ingest path sets it (K-2),
	// so a fact the broker delivered is already excluded here and the fallback can
	// never double-fan-out a healthy delivery. The age predicate then holds the
	// fallback back until the broker has demonstrably had its window.
	const claimQ = `
		SELECT id, event_id, type
		FROM domain_events
		WHERE dispatched_at IS NULL
		  AND created_at <= NOW() - make_interval(secs => $2)
		ORDER BY id ASC
		LIMIT $1
		FOR UPDATE SKIP LOCKED`
	rows, err := tx.Query(ctx, claimQ, limit, minAge.Seconds())
	if err != nil {
		return 0, fmt.Errorf("events fan-out claim: %w", err)
	}
	type pending struct {
		pk        int64
		eventID   string
		eventType string
	}
	var batch []pending
	for rows.Next() {
		var p pending
		if err := rows.Scan(&p.pk, &p.eventID, &p.eventType); err != nil {
			rows.Close()
			return 0, fmt.Errorf("events fan-out scan: %w", err)
		}
		batch = append(batch, p)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return 0, fmt.Errorf("events fan-out claim: %w", err)
	}
	if len(batch) == 0 {
		return 0, nil
	}

	for _, p := range batch {
		for _, c := range consumers {
			if !c.Wants(p.eventType) {
				continue
			}
			if _, err := tx.Exec(ctx, insertConsumptionSQL, p.eventID, c.Name, p.pk, p.eventType); err != nil {
				return 0, fmt.Errorf("events fan-out insert %s: %w", c.Name, err)
			}
		}
		if _, err := tx.Exec(ctx, `UPDATE domain_events SET dispatched_at = NOW() WHERE id = $1`, p.pk); err != nil {
			return 0, fmt.Errorf("events fan-out mark dispatched: %w", err)
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return 0, fmt.Errorf("events fan-out commit: %w", err)
	}
	return len(batch), nil
}

const insertConsumptionSQL = `
	INSERT INTO domain_event_consumptions (event_id, consumer, event_pk, type)
	VALUES ($1, $2, $3, $4)
	ON CONFLICT (event_id, consumer) DO NOTHING`

// FanOutEnvelope creates consumption rows for a fact that arrived off the wire.
// Idempotent, so a Kafka redelivery or rebalance costs nothing.
func (s *Store) FanOutEnvelope(ctx context.Context, env *events.Envelope, consumers []events.ConsumerBinding) error {
	if env == nil || len(consumers) == 0 {
		return nil
	}
	// The relay published this row, so it exists locally; look up its PK to keep
	// the ledger joinable. A fact produced by another service would not be
	// found — record it with PK 0 rather than dropping it.
	var pk int64
	err := s.db.QueryRow(ctx,
		`SELECT id FROM domain_events WHERE idempotency_key = $1`,
		env.Rumera.IdempotencyKey,
	).Scan(&pk)
	if err != nil && err != pgx.ErrNoRows {
		return fmt.Errorf("events fan-out envelope lookup: %w", err)
	}
	for _, c := range consumers {
		if !c.Wants(env.Type) {
			continue
		}
		if _, err := s.db.Exec(ctx, insertConsumptionSQL, env.ID, c.Name, pk, env.Type); err != nil {
			return fmt.Errorf("events fan-out envelope %s: %w", c.Name, err)
		}
	}
	if pk != 0 {
		if _, err := s.db.Exec(ctx,
			`UPDATE domain_events SET dispatched_at = NOW() WHERE id = $1 AND dispatched_at IS NULL`,
			pk,
		); err != nil {
			return fmt.Errorf("events fan-out envelope mark dispatched: %w", err)
		}
	}
	return nil
}

// ClaimDue leases runnable consumption rows and returns them with their fact.
//
// `lease` is the visibility timeout: the claim pushes available_at that far
// into the future, so the row is invisible to every other consume loop and
// every other replica while its handler runs.
//
// The lease — not the row lock — is what provides mutual exclusion.
// FOR UPDATE SKIP LOCKED only holds for the duration of this single autocommit
// statement; the instant it returns, the lock is gone. Without moving
// available_at, the next loop one second later would re-claim the same row and
// run the handler concurrently with itself, sending two emails and burning the
// retry budget on a handler that had not even failed.
//
// It also self-heals: if the process dies mid-handler, the row simply becomes
// runnable again once the lease expires, instead of being stuck forever.
func (s *Store) ClaimDue(ctx context.Context, limit int, lease time.Duration) ([]events.Due, error) {
	if limit <= 0 {
		limit = 50
	}
	if lease <= 0 {
		lease = time.Minute
	}
	const q = `
		WITH claimed AS (
			SELECT event_id, consumer
			FROM domain_event_consumptions
			WHERE status IN ('pending', 'retry') AND available_at <= NOW()
			ORDER BY available_at ASC, event_pk ASC
			LIMIT $1
			FOR UPDATE SKIP LOCKED
		)
		UPDATE domain_event_consumptions dc
		SET attempts     = dc.attempts + 1,
		    available_at = NOW() + $2::interval
		FROM claimed c
		WHERE dc.event_id = c.event_id AND dc.consumer = c.consumer
		RETURNING dc.event_pk, dc.consumer, dc.attempts, dc.event_id`
	rows, err := s.db.Query(ctx, q, limit, lease)
	if err != nil {
		return nil, fmt.Errorf("events claim due: %w", err)
	}
	type claim struct {
		pk       int64
		consumer string
		attempts int
		eventID  string
	}
	var claims []claim
	for rows.Next() {
		var c claim
		if err := rows.Scan(&c.pk, &c.consumer, &c.attempts, &c.eventID); err != nil {
			rows.Close()
			return nil, fmt.Errorf("events claim due scan: %w", err)
		}
		claims = append(claims, c)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("events claim due: %w", err)
	}

	out := make([]events.Due, 0, len(claims))
	for _, c := range claims {
		env, err := s.loadEnvelope(ctx, c.eventID)
		if err != nil {
			return nil, err
		}
		if env == nil {
			// The fact was pruned out from under an unfinished consumption. Park
			// it so an operator sees it instead of retrying a ghost forever.
			_ = s.MarkDLQ(ctx, c.eventID, c.consumer, "domain event row missing (pruned?)")
			continue
		}
		out = append(out, events.Due{
			EventPK:  c.pk,
			Consumer: c.consumer,
			Attempts: c.attempts,
			Envelope: env,
		})
	}
	return out, nil
}

func (s *Store) loadEnvelope(ctx context.Context, eventID string) (*events.Envelope, error) {
	const q = `
		SELECT id, event_id, type, source, subject, partition_key, spec_version,
		       occurred_at, data, correlation_id, causation_id, traceparent,
		       idempotency_key, publish_attempts
		FROM domain_events
		WHERE event_id = $1`
	row, err := scanRowFrom(s.db.QueryRow(ctx, q, eventID))
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("events load envelope: %w", err)
	}
	return row.Envelope, nil
}

// MarkDone settles a consumption row.
//
// The status predicate makes a settled row terminal. Without it a straggler —
// a duplicate claim, a slow retry finishing after a faster one — could move a
// row backwards (done → retry) and cause the handler to run again.
func (s *Store) MarkDone(ctx context.Context, eventID, consumer string) error {
	const q = `
		UPDATE domain_event_consumptions
		SET status = 'done', processed_at = NOW(), last_error = NULL
		WHERE event_id = $1 AND consumer = $2 AND status IN ('pending', 'retry')`
	if _, err := s.db.Exec(ctx, q, eventID, consumer); err != nil {
		return fmt.Errorf("events mark done: %w", err)
	}
	return nil
}

// MarkRetry schedules another attempt.
func (s *Store) MarkRetry(ctx context.Context, eventID, consumer, errMsg string, availableAt time.Time) error {
	const q = `
		UPDATE domain_event_consumptions
		SET status = 'retry', available_at = $3, last_error = $4
		WHERE event_id = $1 AND consumer = $2 AND status IN ('pending', 'retry')`
	if _, err := s.db.Exec(ctx, q, eventID, consumer, availableAt, truncate(errMsg, 1000)); err != nil {
		return fmt.Errorf("events mark retry: %w", err)
	}
	return nil
}

// MarkDLQ parks a consumption row for an operator.
func (s *Store) MarkDLQ(ctx context.Context, eventID, consumer, errMsg string) error {
	const q = `
		UPDATE domain_event_consumptions
		SET status = 'dlq', processed_at = NOW(), last_error = $3
		WHERE event_id = $1 AND consumer = $2 AND status IN ('pending', 'retry')`
	if _, err := s.db.Exec(ctx, q, eventID, consumer, truncate(errMsg, 1000)); err != nil {
		return fmt.Errorf("events mark dlq: %w", err)
	}
	return nil
}

// OldestPendingAge is the lag gauge: how long the oldest runnable row has been
// waiting. This is the number to alert on.
func (s *Store) OldestPendingAge(ctx context.Context) (time.Duration, error) {
	const q = `
		SELECT COALESCE(EXTRACT(EPOCH FROM (NOW() - MIN(available_at))), 0)
		FROM domain_event_consumptions
		WHERE status IN ('pending', 'retry') AND available_at <= NOW()`
	var seconds float64
	if err := s.db.QueryRow(ctx, q).Scan(&seconds); err != nil {
		return 0, fmt.Errorf("events oldest pending: %w", err)
	}
	if seconds < 0 {
		seconds = 0
	}
	return time.Duration(seconds * float64(time.Second)), nil
}

// OldestUnpublishedAge is the relay-side lag gauge: how long the oldest fact has
// been waiting to reach Kafka. Unlike OldestPendingAge this reads from
// domain_events, not the consumption ledger, so it is the one gauge that still
// moves when the broker is down and no consumption rows are being created at all
// (K-3). Meaningless on the Postgres bus, where published_at is never set.
func (s *Store) OldestUnpublishedAge(ctx context.Context) (time.Duration, error) {
	const q = `
		SELECT COALESCE(EXTRACT(EPOCH FROM (NOW() - MIN(created_at))), 0)
		FROM domain_events
		WHERE published_at IS NULL`
	var seconds float64
	if err := s.db.QueryRow(ctx, q).Scan(&seconds); err != nil {
		return 0, fmt.Errorf("events oldest unpublished: %w", err)
	}
	if seconds < 0 {
		seconds = 0
	}
	return time.Duration(seconds * float64(time.Second)), nil
}

// CountByStatus reports ledger depth per status.
func (s *Store) CountByStatus(ctx context.Context) (map[string]int64, error) {
	const q = `SELECT status, COUNT(*) FROM domain_event_consumptions GROUP BY status`
	rows, err := s.db.Query(ctx, q)
	if err != nil {
		return nil, fmt.Errorf("events count by status: %w", err)
	}
	defer rows.Close()
	out := map[string]int64{}
	for rows.Next() {
		var status string
		var n int64
		if err := rows.Scan(&status, &n); err != nil {
			return nil, fmt.Errorf("events count by status scan: %w", err)
		}
		out[status] = n
	}
	return out, rows.Err()
}

// Prune deletes settled facts older than the retention horizon.
//
// A fact is only deletable when every consumption row is done — a pending,
// retrying or dead-lettered row keeps the fact alive so it stays replayable.
func (s *Store) Prune(ctx context.Context, olderThan time.Time, limit int) (int64, error) {
	if limit <= 0 {
		limit = 5000
	}
	const q = `
		WITH prunable AS (
			SELECT e.id, e.event_id
			FROM domain_events e
			WHERE e.created_at < $1
			  -- Positive evidence that the fact was actually delivered. A fact
			  -- with NO consumption rows has never been fanned out (worker down,
			  -- relay parked, EVENTS_WORKER=off) and satisfies a bare NOT EXISTS
			  -- vacuously — deleting it would destroy an undelivered side effect,
			  -- the exact opposite of the retention rule.
			  AND EXISTS (
			      SELECT 1 FROM domain_event_consumptions dc
			      WHERE dc.event_id = e.event_id
			  )
			  AND NOT EXISTS (
			      SELECT 1 FROM domain_event_consumptions dc
			      WHERE dc.event_id = e.event_id AND dc.status <> 'done'
			  )
			ORDER BY e.id ASC
			LIMIT $2
		), dropped_consumptions AS (
			DELETE FROM domain_event_consumptions dc
			USING prunable p
			WHERE dc.event_id = p.event_id
		)
		DELETE FROM domain_events e
		USING prunable p
		WHERE e.id = p.id`
	tag, err := s.db.Exec(ctx, q, olderThan, limit)
	if err != nil {
		return 0, fmt.Errorf("events prune: %w", err)
	}
	return tag.RowsAffected(), nil
}

// Replay revives dead-lettered consumption rows. The idempotency key is
// unchanged, so a handler that already had an effect stays protected by its own
// domain constraint.
func (s *Store) Replay(ctx context.Context, consumer string, limit int) (int64, error) {
	if limit <= 0 {
		limit = 1000
	}
	const q = `
		WITH revive AS (
			SELECT event_id, consumer
			FROM domain_event_consumptions
			WHERE status = 'dlq' AND ($1 = '' OR consumer = $1)
			ORDER BY created_at ASC
			LIMIT $2
		)
		UPDATE domain_event_consumptions dc
		SET status = 'pending', available_at = NOW(), attempts = 0, processed_at = NULL
		FROM revive r
		WHERE dc.event_id = r.event_id AND dc.consumer = r.consumer`
	tag, err := s.db.Exec(ctx, q, consumer, limit)
	if err != nil {
		return 0, fmt.Errorf("events replay: %w", err)
	}
	return tag.RowsAffected(), nil
}

// ── scanning helpers ─────────────────────────────────────────────────────────

type scanner interface {
	Scan(dest ...any) error
}

func scanRow(rows pgx.Rows) (events.Row, error) { return scanRowFrom(rows) }

func scanRowFrom(sc scanner) (events.Row, error) {
	var (
		row           events.Row
		env           events.Envelope
		data          []byte
		correlationID *string
		causationID   *string
		traceparent   *string
		partitionKey  string
	)
	err := sc.Scan(
		&row.PK, &env.ID, &env.Type, &env.Source, &env.Subject, &partitionKey,
		&env.SpecVersion, &env.Time, &data, &correlationID, &causationID,
		&traceparent, &env.Rumera.IdempotencyKey, &row.PublishAttempts,
	)
	if err != nil {
		return events.Row{}, err
	}
	env.DataContentType = "application/json"
	env.Data = json.RawMessage(data)
	env.Rumera.PartitionKey = partitionKey
	env.Rumera.CorrelationID = deref(correlationID)
	env.Rumera.CausationID = deref(causationID)
	env.Rumera.Traceparent = deref(traceparent)
	row.Envelope = &env
	return row, nil
}

func deref(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

func nullIfEmpty(s string) any {
	if s == "" {
		return nil
	}
	return s
}

func truncate(s string, max int) string {
	if len(s) <= max {
		return s
	}
	return s[:max]
}
