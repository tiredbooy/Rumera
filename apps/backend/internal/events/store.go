package events

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
)

// Consumption status values. Mirrors the CHECK constraint on
// domain_event_consumptions.
const (
	StatusPending = "pending"
	StatusRetry   = "retry"
	StatusDone    = "done"
	StatusDLQ     = "dlq"
)

// Row is a persisted domain event.
type Row struct {
	PK              int64
	Envelope        *Envelope
	PublishAttempts int
}

// Due is a consumption row that is ready to run.
type Due struct {
	EventPK  int64
	Consumer string
	Attempts int
	Envelope *Envelope
}

// Store persists facts and the per-consumer delivery ledger.
//
// EnqueueTx is the only method a domain service ever calls, and it is the whole
// point of the package: the fact lands in the caller's open transaction, so it
// commits or rolls back with the money.
type Store interface {
	// EnqueueTx inserts a fact on the caller's open transaction. A duplicate
	// idempotency_key is a no-op success, so a replayed webhook or a retried
	// Confirm produces exactly one fact.
	EnqueueTx(ctx context.Context, tx pgx.Tx, env *Envelope) error

	// Enqueue inserts a fact on the pool. Only for facts with no surrounding
	// domain transaction — prefer EnqueueTx everywhere else.
	Enqueue(ctx context.Context, env *Envelope) error

	// ClaimUnpublished locks and returns up to limit facts awaiting relay to
	// Kafka. Uses FOR UPDATE SKIP LOCKED so multiple relays are safe.
	ClaimUnpublished(ctx context.Context, limit int) ([]Row, error)

	// MarkPublished records a successful produce.
	MarkPublished(ctx context.Context, pk int64) error

	// MarkPublishError backs the row off instead of leaving it eligible on every
	// tick — otherwise a permanently failing row starves the batch forever.
	MarkPublishError(ctx context.Context, pk int64, errMsg string, retryAfter time.Time) error

	// FanOut creates one pending consumption row per consumer for facts that do
	// not have them yet, and marks those facts dispatched. Returns how many
	// facts were fanned out. Used by the Postgres bus.
	// minAge gates the claim to facts older than it. Postgres mode passes 0 —
	// fan out immediately. Kafka mode passes the fallback window so this only
	// ever picks up what the broker demonstrably failed to deliver (K-4).
	FanOut(ctx context.Context, consumers []ConsumerBinding, limit int, minAge time.Duration) (int, error)

	// FanOutEnvelope creates consumption rows for a single fact that arrived off
	// the wire (Kafka). Idempotent — redelivery is a no-op.
	FanOutEnvelope(ctx context.Context, env *Envelope, consumers []ConsumerBinding) error

	// ClaimDue leases and returns runnable consumption rows. `lease` is the
	// visibility timeout — the claim hides the row from other workers for that
	// long, which is what stops a handler running concurrently with itself and
	// what lets a crashed worker's row become runnable again on its own.
	ClaimDue(ctx context.Context, limit int, lease time.Duration) ([]Due, error)

	// MarkDone settles a consumption row.
	MarkDone(ctx context.Context, eventID, consumer string) error

	// MarkRetry schedules another attempt.
	MarkRetry(ctx context.Context, eventID, consumer, errMsg string, availableAt time.Time) error

	// MarkDLQ parks a consumption row for an operator.
	MarkDLQ(ctx context.Context, eventID, consumer, errMsg string) error

	// OldestPendingAge reports how far behind the bus is. Zero when idle.
	OldestPendingAge(ctx context.Context) (time.Duration, error)

	// OldestUnpublishedAge reports how long the oldest fact has waited for relay
	// to Kafka. This is the gauge that still moves when the broker is down, when
	// no consumption rows exist for OldestPendingAge to measure (K-3).
	OldestUnpublishedAge(ctx context.Context) (time.Duration, error)

	// CountByStatus reports ledger depth per status, for metrics and ops.
	CountByStatus(ctx context.Context) (map[string]int64, error)

	// Prune deletes settled facts and their consumption rows older than the
	// retention window. Never touches facts with unfinished consumptions.
	Prune(ctx context.Context, olderThan time.Time, limit int) (int64, error)

	// Replay resets dead-lettered consumption rows back to pending. Consumer
	// empty means every consumer. Returns how many rows were revived.
	Replay(ctx context.Context, consumer string, limit int) (int64, error)
}

// ConsumerBinding is the registry's view of a consumer: its name and the fact
// types it wants.
type ConsumerBinding struct {
	Name  string
	Types []string
}

// Wants reports whether this consumer subscribes to eventType.
func (b ConsumerBinding) Wants(eventType string) bool {
	for _, t := range b.Types {
		if t == eventType {
			return true
		}
	}
	return false
}
