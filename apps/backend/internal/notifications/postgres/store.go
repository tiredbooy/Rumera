// Package postgres implements OutboxStore and DeliveryStore against the main
// application database (see migration notification_outbox).
package postgres

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tiredbooy/internal/notifications"
)

// Store implements notifications.OutboxStore and notifications.DeliveryStore.
type Store struct {
	db *pgxpool.Pool
}

func NewStore(db *pgxpool.Pool) *Store {
	return &Store{db: db}
}

const enqueueSQL = `
	INSERT INTO notification_outbox (topic, partition_key, payload, idempotency_key)
	VALUES ($1, $2, $3::jsonb, $4)
	ON CONFLICT (idempotency_key) DO NOTHING`

func (s *Store) Enqueue(ctx context.Context, topic, partitionKey, idempotencyKey string, payload []byte) error {
	_, err := s.db.Exec(ctx, enqueueSQL, topic, partitionKey, payload, idempotencyKey)
	if err != nil {
		return fmt.Errorf("notification outbox enqueue: %w", err)
	}
	return nil
}

// EnqueueTx writes the command on the caller's open transaction.
//
// Without this a notification is a dual write: the row lands on a separate pool
// connection and commits even when the domain transaction rolls back, so a
// rolled-back gift card can still email its code.
func (s *Store) EnqueueTx(ctx context.Context, tx pgx.Tx, topic, partitionKey, idempotencyKey string, payload []byte) error {
	if tx == nil {
		return fmt.Errorf("notifications: EnqueueTx requires an open transaction")
	}
	_, err := tx.Exec(ctx, enqueueSQL, topic, partitionKey, payload, idempotencyKey)
	if err != nil {
		return fmt.Errorf("notification outbox enqueue tx: %w", err)
	}
	return nil
}

// ClaimUnpublished locks a batch of pending commands.
//
// The lock is what makes multiple relays safe; the previous plain SELECT let
// every replica publish every row. publish_after skips rows that are backing
// off, so one permanently failing row can no longer occupy the whole batch on
// every tick and starve everything behind it.
func (s *Store) ClaimUnpublished(ctx context.Context, limit int) ([]notifications.OutboxRow, error) {
	if limit <= 0 {
		limit = 50
	}
	const q = `
		WITH claimed AS (
			SELECT id
			FROM notification_outbox
			WHERE published_at IS NULL AND publish_after <= NOW()
			ORDER BY publish_after ASC, id ASC
			LIMIT $1
			FOR UPDATE SKIP LOCKED
		)
		UPDATE notification_outbox o
		SET publish_attempts = o.publish_attempts + 1
		FROM claimed c
		WHERE o.id = c.id
		RETURNING o.id, o.topic, o.partition_key, o.payload, o.idempotency_key,
		          o.created_at, o.published_at, o.publish_error, o.publish_attempts`
	rows, err := s.db.Query(ctx, q, limit)
	if err != nil {
		return nil, fmt.Errorf("notification outbox claim: %w", err)
	}
	defer rows.Close()

	var out []notifications.OutboxRow
	for rows.Next() {
		var row notifications.OutboxRow
		if err := rows.Scan(
			&row.ID, &row.Topic, &row.PartitionKey, &row.Payload, &row.IdempotencyKey,
			&row.CreatedAt, &row.PublishedAt, &row.PublishError, &row.PublishAttempts,
		); err != nil {
			return nil, fmt.Errorf("notification outbox scan: %w", err)
		}
		out = append(out, row)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return out, nil
}

func (s *Store) MarkPublished(ctx context.Context, id int64) error {
	const q = `
		UPDATE notification_outbox
		SET published_at = NOW(), publish_error = NULL
		WHERE id = $1 AND published_at IS NULL`
	_, err := s.db.Exec(ctx, q, id)
	if err != nil {
		return fmt.Errorf("notification outbox mark published: %w", err)
	}
	return nil
}

// MarkPublishError records the failure and backs the row off so it stops
// monopolising the batch.
func (s *Store) MarkPublishError(ctx context.Context, id int64, errMsg string) error {
	const q = `
		UPDATE notification_outbox
		SET publish_error = $2,
		    publish_after = NOW() + LEAST(
		        INTERVAL '1 hour',
		        (INTERVAL '2 seconds' * POWER(2, LEAST(publish_attempts, 12)))
		    )
		WHERE id = $1 AND published_at IS NULL`
	_, err := s.db.Exec(ctx, q, id, truncate(errMsg, 1000))
	if err != nil {
		return fmt.Errorf("notification outbox mark error: %w", err)
	}
	return nil
}

// TryBegin claims the delivery slot for a key. Returns true when the caller
// should perform the side effect.
//
// This is a claim, not a receipt. The previous version inserted a row and
// treated its existence as "delivered", so the FIRST provider failure marked
// the message done forever — at-least-once silently became at-most-never. Now
// only a confirmed row short-circuits; a pending or failed row is re-claimed so
// the retry actually re-sends.
//
// The residual risk is the narrow window between a successful provider call and
// ConfirmDelivery: a crash there re-sends once. That is the correct side of the
// trade — a duplicate OTP is recoverable, a login the user can never complete
// is not.
func (s *Store) TryBegin(ctx context.Context, idempotencyKey, topic, eventID, channel string) (bool, error) {
	const q = `
		INSERT INTO notification_deliveries
			(idempotency_key, topic, event_id, channel, status, attempts, claimed_at)
		VALUES ($1, $2, $3, $4, 'pending', 1, NOW())
		ON CONFLICT (idempotency_key) DO UPDATE
		SET attempts   = notification_deliveries.attempts + 1,
		    claimed_at = NOW(),
		    status     = 'pending'
		WHERE notification_deliveries.status <> 'delivered'
		RETURNING idempotency_key`
	var key string
	err := s.db.QueryRow(ctx, q, idempotencyKey, topic, eventID, channel).Scan(&key)
	if errors.Is(err, pgx.ErrNoRows) {
		// The conflict target existed and was already delivered.
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("notification delivery begin: %w", err)
	}
	return true, nil
}

// ConfirmDelivery marks the side effect as actually performed.
func (s *Store) ConfirmDelivery(ctx context.Context, idempotencyKey string) error {
	const q = `
		UPDATE notification_deliveries
		SET status = 'delivered', delivered_at = NOW(), last_error = NULL
		WHERE idempotency_key = $1`
	if _, err := s.db.Exec(ctx, q, idempotencyKey); err != nil {
		return fmt.Errorf("notification delivery confirm: %w", err)
	}
	return nil
}

// FailDelivery releases the claim so the next attempt re-sends.
func (s *Store) FailDelivery(ctx context.Context, idempotencyKey, errMsg string) error {
	const q = `
		UPDATE notification_deliveries
		SET status = 'failed', last_error = $2
		WHERE idempotency_key = $1 AND status <> 'delivered'`
	if _, err := s.db.Exec(ctx, q, idempotencyKey, truncate(errMsg, 1000)); err != nil {
		return fmt.Errorf("notification delivery fail: %w", err)
	}
	return nil
}

// PruneDelivered removes settled delivery rows older than the horizon.
//
// The ledger is an idempotency guard, not an audit log — but it must outlive
// any possible redelivery, so keep the horizon comfortably longer than Kafka
// retention.
func (s *Store) PruneDelivered(ctx context.Context, olderThan time.Time, limit int) (int64, error) {
	if limit <= 0 {
		limit = 5000
	}
	const q = `
		DELETE FROM notification_deliveries
		WHERE idempotency_key IN (
			SELECT idempotency_key
			FROM notification_deliveries
			WHERE status = 'delivered' AND delivered_at < $1
			ORDER BY delivered_at ASC
			LIMIT $2
		)`
	tag, err := s.db.Exec(ctx, q, olderThan, limit)
	if err != nil {
		return 0, fmt.Errorf("notification delivery prune: %w", err)
	}
	return tag.RowsAffected(), nil
}

// PrunePublished removes relayed outbox rows older than the horizon.
func (s *Store) PrunePublished(ctx context.Context, olderThan time.Time, limit int) (int64, error) {
	if limit <= 0 {
		limit = 5000
	}
	const q = `
		DELETE FROM notification_outbox
		WHERE id IN (
			SELECT id FROM notification_outbox
			WHERE published_at IS NOT NULL AND published_at < $1
			ORDER BY published_at ASC
			LIMIT $2
		)`
	tag, err := s.db.Exec(ctx, q, olderThan, limit)
	if err != nil {
		return 0, fmt.Errorf("notification outbox prune: %w", err)
	}
	return tag.RowsAffected(), nil
}

func truncate(s string, max int) string {
	if len(s) <= max {
		return s
	}
	return s[:max]
}

// Ensure compile-time interface satisfaction.
var (
	_ notifications.OutboxStore   = (*Store)(nil)
	_ notifications.DeliveryStore = (*Store)(nil)
	_ notifications.TxOutboxStore = (*Store)(nil)
)
