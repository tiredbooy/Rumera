// Package events is the domain-fact bus: a transactional outbox plus idempotent
// consumers.
//
// A producer writes a fact (`order.paid.v1`) to domain_events inside the SAME
// Postgres transaction as the business write, so the fact and the money can
// never disagree. A worker then fans the fact out to registered consumers, each
// with its own ledger row, retry budget and dead-letter state.
//
// Transport is configurable: EVENTS_BUS=postgres consumes straight from the
// outbox (no broker needed, the default), EVENTS_BUS=kafka relays rows to a
// topic first. Consumers are identical either way.
//
// Facts are not commands. Reserve/deduct/refund/wallet-debit stay explicit SQL
// in their own transaction — events notify, they are never the ledger.
package events

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
)

// Envelope is the CloudEvents 1.0 subset written to the outbox and the wire.
// It mirrors notifications.Envelope (same specversion/id/type/source/time/data
// shape) so operators read one format, and adds the fields a multi-consumer
// fact bus needs: subject, causation and trace context.
type Envelope struct {
	SpecVersion     string          `json:"specversion"`
	ID              string          `json:"id"`
	Type            string          `json:"type"`
	Source          string          `json:"source"`
	Subject         string          `json:"subject"`
	Time            time.Time       `json:"time"`
	DataContentType string          `json:"datacontenttype"`
	Data            json.RawMessage `json:"data"`
	Rumera          Meta            `json:"rumera"`
}

// Meta carries cross-cutting delivery and correlation fields.
type Meta struct {
	CorrelationID  string `json:"correlation_id,omitempty"`
	CausationID    string `json:"causation_id,omitempty"`
	IdempotencyKey string `json:"idempotency_key"`
	Traceparent    string `json:"traceparent,omitempty"`
	// PartitionKey orders related facts on the same Kafka partition. Defaults to
	// Subject when unset.
	PartitionKey string `json:"partition_key,omitempty"`
}

const (
	// SourceAPI matches notifications.SourceAPI so both streams agree.
	SourceAPI = "rumera/api"

	// SpecVersion is the CloudEvents version of the wire format.
	SpecVersion = "1.0"
)

// ── Fact catalog ─────────────────────────────────────────────────────────────
// Type names are {aggregate}.{verb}.v{N}. Bump the suffix on a breaking payload
// change; additive fields do not need a bump because consumers ignore unknown
// keys.

const (
	// TypeOrderPaidV1 is emitted from BOTH paid rails — gateway Confirm and
	// wallet checkout — inside the transaction that marks the order paid.
	TypeOrderPaidV1 = "order.paid.v1"

	// TypeTestPingV1 exercises the loop end to end without touching a domain
	// table. Used by the golden-path test and by ops smoke checks.
	TypeTestPingV1 = "test.ping.v1"
)

// OrderPaidData is the payload of TypeOrderPaidV1.
//
// Keyed on what BOTH rails have. The wallet rail writes no payment_transactions
// row at all, so PaymentID/Method are optional and consumers must not require
// them.
type OrderPaidData struct {
	OrderID int64   `json:"order_id"`
	UserID  int64   `json:"user_id"`
	Amount  float64 `json:"amount"`
	// Rail is "gateway" or "wallet" — for analytics and debugging, not routing.
	Rail string `json:"rail"`
	// PaymentID is absent on the wallet rail.
	PaymentID *int64    `json:"payment_id,omitempty"`
	PaidAt    time.Time `json:"paid_at"`
}

// OrderPaidKey is the idempotency key for TypeOrderPaidV1.
//
// Deliberately keyed on the order alone, not the payment: it is what makes the
// two rails unable to double-emit for one order, and what collapses a replayed
// webhook or a double Confirm into a single fact.
func OrderPaidKey(orderID int64) string {
	return fmt.Sprintf("order:%d:paid", orderID)
}

// ── Routing ──────────────────────────────────────────────────────────────────

// defaultTopic carries every domain fact. One topic keeps ordering per subject
// simple and avoids topic sprawl; split per-type only when a consumer group
// genuinely needs to scale alone.
const defaultTopic = "rumera.domain.v1"

// topics maps a fact type to its transport topic. Unlike the notifications
// routing table this is fail-OPEN: an unregistered type falls back to the
// default topic rather than returning an error.
//
// That difference is deliberate and load-bearing. Producers call this from
// inside an open money transaction; if routing could fail, adding a new fact
// type without touching this map would roll back every settled payment on that
// path. A misrouted event is recoverable, a rolled-back charge is not.
var topics = map[string]string{
	TypeOrderPaidV1: defaultTopic,
	TypeTestPingV1:  defaultTopic,
}

// TopicFor returns the transport topic for a fact type. Never errors — see the
// note on `topics`.
func TopicFor(eventType string) string {
	if t, ok := topics[eventType]; ok {
		return t
	}
	return defaultTopic
}

// Topics lists every topic the consumer side must subscribe to.
func Topics() []string {
	seen := map[string]struct{}{defaultTopic: {}}
	for _, t := range topics {
		seen[t] = struct{}{}
	}
	out := make([]string, 0, len(seen))
	for t := range seen {
		out = append(out, t)
	}
	return out
}

// DLQTopic is the dead-letter topic for a main topic. Only used in Kafka mode;
// the Postgres bus dead-letters in the consumption ledger instead.
func DLQTopic(topic string) string { return topic + ".dlq" }

// ── Construction ─────────────────────────────────────────────────────────────

// New builds a validated envelope with a fresh message id.
//
// subject is "{aggregate}:{id}" (e.g. "order:42") and doubles as the default
// partition key. idempotencyKey must be a stable business key — it is UNIQUE on
// the outbox, so it is what makes a retried producer a no-op.
func New(eventType, subject, idempotencyKey string, data any) (*Envelope, error) {
	eventType = strings.TrimSpace(eventType)
	idempotencyKey = strings.TrimSpace(idempotencyKey)
	if eventType == "" {
		return nil, fmt.Errorf("events: type is required")
	}
	if idempotencyKey == "" {
		return nil, fmt.Errorf("events: idempotency_key is required")
	}
	raw, err := json.Marshal(data)
	if err != nil {
		return nil, fmt.Errorf("events: marshal data: %w", err)
	}
	return &Envelope{
		SpecVersion:     SpecVersion,
		ID:              uuid.NewString(),
		Type:            eventType,
		Source:          SourceAPI,
		Subject:         subject,
		Time:            time.Now().UTC(),
		DataContentType: "application/json",
		Data:            raw,
		Rumera: Meta{
			IdempotencyKey: idempotencyKey,
			PartitionKey:   subject,
		},
	}, nil
}

// WithCorrelation stamps request-scoped correlation and trace context so worker
// spans stitch back to the HTTP request that caused the fact.
func (e *Envelope) WithCorrelation(correlationID, traceparent string) *Envelope {
	e.Rumera.CorrelationID = correlationID
	e.Rumera.Traceparent = traceparent
	return e
}

// PartitionKey is the ordering key on the wire. Falls back to the subject, then
// to a constant so a message is never keyless.
func (e *Envelope) PartitionKey() string {
	if e.Rumera.PartitionKey != "" {
		return e.Rumera.PartitionKey
	}
	if e.Subject != "" {
		return e.Subject
	}
	return "default"
}

// UnmarshalData decodes the fact payload into dst.
func (e *Envelope) UnmarshalData(dst any) error {
	if err := json.Unmarshal(e.Data, dst); err != nil {
		return fmt.Errorf("events: unmarshal %s data: %w", e.Type, err)
	}
	return nil
}
