package events

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/tiredbooy/internal/notifications"
)

// Ingester records a fact that arrived off the wire. Implemented by *Worker.
type Ingester interface {
	Ingest(ctx context.Context, env *Envelope) error
}

// KafkaIngestHandler adapts the domain bus to the existing Kafka consumer's
// MessageHandler contract.
//
// It does NOT run handlers inline. A Kafka message is only translated into
// consumption ledger rows and the offset is committed once those are durable;
// the consume loop then runs the actual handlers with their own retry budget.
//
// That split is deliberate. Running handlers inline would tie the partition's
// progress to the slowest consumer — one failing handler would block every
// unrelated fact behind it (head-of-line blocking), and a Kafka retry would
// re-run the handlers that already succeeded. Writing the ledger first makes
// each consumer fail and retry independently.
type KafkaIngestHandler struct {
	Worker Ingester
}

// Handle returns (done, err) per the consumer contract: done=true commits.
func (h *KafkaIngestHandler) Handle(ctx context.Context, topic string, raw []byte) (bool, error) {
	var env Envelope
	if err := json.Unmarshal(raw, &env); err != nil {
		// Poison payload — permanent, so the consumer DLQs it rather than
		// spinning on something that will never parse.
		return true, fmt.Errorf("events: invalid envelope on %s: %w", topic, err)
	}
	if env.ID == "" || env.Type == "" {
		return true, fmt.Errorf("events: envelope on %s missing id or type", topic)
	}
	if h.Worker == nil {
		return true, fmt.Errorf("events: no worker to ingest into")
	}
	// Idempotent: a redelivery or rebalance re-inserts nothing.
	if err := h.Worker.Ingest(ctx, &env); err != nil {
		// The ledger write failed — the database is down, the message is fine.
		// Must not commit (the fact would be lost) and must not be allowed to
		// exhaust into the dead-letter topic either, because in Kafka mode this
		// ledger row is the ONLY thing that ever causes the fact to be consumed.
		// ErrRetryIndefinitely tells the consumer to keep trying.
		return false, fmt.Errorf("%w: events ingest: %v", notifications.ErrRetryIndefinitely, err)
	}
	return true, nil
}
