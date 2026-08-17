package notifications

import (
	"context"
	"encoding/json"
	"time"

	"github.com/jackc/pgx/v5"
)

// OutboxRow is a durable pending (or published) Kafka message.
type OutboxRow struct {
	ID              int64
	Topic           string
	PartitionKey    string
	Payload         json.RawMessage
	IdempotencyKey  string
	CreatedAt       time.Time
	PublishedAt     *time.Time
	PublishError    *string
	PublishAttempts int
}

// OutboxStore persists notification intents atomically with domain writes.
type OutboxStore interface {
	// Enqueue inserts a row; duplicate idempotency_key is a no-op success.
	Enqueue(ctx context.Context, topic, partitionKey, idempotencyKey string, payload []byte) error
	// ClaimUnpublished returns up to limit unpublished rows, locked FOR UPDATE
	// SKIP LOCKED so concurrent relays never publish the same row twice.
	ClaimUnpublished(ctx context.Context, limit int) ([]OutboxRow, error)
	// MarkPublished records successful produce.
	MarkPublished(ctx context.Context, id int64) error
	// MarkPublishError records a produce failure without dropping the row, and
	// backs it off so it does not starve the batch.
	MarkPublishError(ctx context.Context, id int64, errMsg string) error
}

// TxOutboxStore enqueues on a caller-supplied transaction, so a notification
// command commits with the domain write that caused it or not at all.
//
// Separate from OutboxStore because the in-memory test fake has no transaction
// to honour; callers type-assert for it.
type TxOutboxStore interface {
	EnqueueTx(ctx context.Context, tx pgx.Tx, topic, partitionKey, idempotencyKey string, payload []byte) error
}

// DeliveryStore is the consumer-side idempotency ledger.
//
// It is a claim/confirm pair, not a single insert: TryBegin reserves the slot
// before the provider call, and exactly one of ConfirmDelivery or FailDelivery
// settles it afterwards. Treating the claim itself as proof of delivery is what
// previously made a failed send unretryable.
type DeliveryStore interface {
	// TryBegin returns true when the caller should perform the side effect —
	// either the key is new, or a previous attempt did not confirm. Returns
	// false only for a confirmed delivery.
	TryBegin(ctx context.Context, idempotencyKey, topic, eventID, channel string) (bool, error)
	// ConfirmDelivery marks the side effect as performed.
	ConfirmDelivery(ctx context.Context, idempotencyKey string) error
	// FailDelivery releases the claim so a retry re-attempts.
	FailDelivery(ctx context.Context, idempotencyKey, errMsg string) error
}

// Publisher sends a serialized envelope to a topic.
type Publisher interface {
	Publish(ctx context.Context, topic, key string, value []byte) error
}

// Relay moves outbox rows to the message bus (Kafka). Safe for multi-instance
// when ClaimUnpublished uses FOR UPDATE SKIP LOCKED.
type Relay struct {
	Outbox    OutboxStore
	Publisher Publisher
	BatchSize int
}

// RunOnce claims a batch and publishes each row.
func (r *Relay) RunOnce(ctx context.Context) (published int, err error) {
	limit := r.BatchSize
	if limit <= 0 {
		limit = 50
	}
	rows, err := r.Outbox.ClaimUnpublished(ctx, limit)
	if err != nil {
		return 0, err
	}
	for _, row := range rows {
		if err := r.Publisher.Publish(ctx, row.Topic, row.PartitionKey, row.Payload); err != nil {
			_ = r.Outbox.MarkPublishError(ctx, row.ID, err.Error())
			continue
		}
		if err := r.Outbox.MarkPublished(ctx, row.ID); err != nil {
			return published, err
		}
		published++
	}
	return published, nil
}

// EnqueueEnvelope validates routing and writes the outbox row.
func EnqueueEnvelope(ctx context.Context, store OutboxStore, env *Envelope) error {
	topic, err := TopicForEvent(env.Type)
	if err != nil {
		return err
	}
	key := PartitionKey(env.Type, env.Data)
	payload, err := json.Marshal(env)
	if err != nil {
		return err
	}
	return store.Enqueue(ctx, topic, key, env.Rumera.IdempotencyKey, payload)
}
