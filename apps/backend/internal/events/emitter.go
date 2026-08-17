package events

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/tiredbooy/pkg/metrics"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/propagation"
)

// Emitter is the producer-facing facade. Domain services depend on a narrow
// local interface over this rather than on the store directly.
//
// Every method takes the caller's open pgx.Tx. That is the entire contract: the
// fact is written on the same transaction as the money, so it commits with it
// or rolls back with it. There is deliberately no pool-based OrderPaid variant
// — a fact emitted outside the transaction that produced it is a dual write.
type Emitter struct {
	store   Store
	enabled bool
}

// NewEmitter builds an emitter. When enabled is false every method is a no-op
// returning nil, so producers keep working with the legacy in-request side
// effects and nothing has to be conditionally compiled at the call site.
func NewEmitter(store Store, enabled bool) *Emitter {
	return &Emitter{store: store, enabled: enabled}
}

// Enabled reports whether facts are actually being written.
func (e *Emitter) Enabled() bool { return e != nil && e.enabled && e.store != nil }

// OrderPaidTx records that an order was paid, on the caller's transaction.
//
// Emitted from BOTH rails — gateway Confirm and wallet checkout — with the same
// type and the same order-keyed idempotency key, so consumers see one uniform
// fact and the two rails can never double-emit for one order.
func (e *Emitter) OrderPaidTx(ctx context.Context, tx pgx.Tx, data OrderPaidData) error {
	if !e.Enabled() {
		return nil
	}
	if data.OrderID <= 0 {
		return fmt.Errorf("events: order.paid requires an order id")
	}
	if data.PaidAt.IsZero() {
		data.PaidAt = time.Now().UTC()
	}
	env, err := New(
		TypeOrderPaidV1,
		fmt.Sprintf("order:%d", data.OrderID),
		OrderPaidKey(data.OrderID),
		data,
	)
	if err != nil {
		return err
	}
	stamp(ctx, env)
	if err := e.store.EnqueueTx(ctx, tx, env); err != nil {
		return err
	}
	metrics.IncEventEnqueued(env.Type)
	return nil
}

// EmitTx writes an arbitrary fact on the caller's transaction. Used by the
// golden-path test and by future producers that do not need a typed helper.
func (e *Emitter) EmitTx(ctx context.Context, tx pgx.Tx, eventType, subject, idempotencyKey string, data any) error {
	if !e.Enabled() {
		return nil
	}
	env, err := New(eventType, subject, idempotencyKey, data)
	if err != nil {
		return err
	}
	stamp(ctx, env)
	if err := e.store.EnqueueTx(ctx, tx, env); err != nil {
		return err
	}
	metrics.IncEventEnqueued(env.Type)
	return nil
}

// Emit writes a fact on the pool. Only for facts with no domain transaction to
// ride — cron sweeps, ops smoke tests.
func (e *Emitter) Emit(ctx context.Context, eventType, subject, idempotencyKey string, data any) error {
	if !e.Enabled() {
		return nil
	}
	env, err := New(eventType, subject, idempotencyKey, data)
	if err != nil {
		return err
	}
	stamp(ctx, env)
	if err := e.store.Enqueue(ctx, env); err != nil {
		return err
	}
	metrics.IncEventEnqueued(env.Type)
	return nil
}

// stamp copies the active trace context onto the envelope so the consumer's
// span links back to the HTTP request that caused the fact.
//
// Without this the trace dies at the outbox and a slow receipt looks unrelated
// to the checkout that triggered it. No-op when tracing is disabled: the
// propagator writes nothing for an invalid span context.
func stamp(ctx context.Context, env *Envelope) {
	carrier := propagation.MapCarrier{}
	otel.GetTextMapPropagator().Inject(ctx, carrier)
	env.Rumera.Traceparent = carrier["traceparent"]
	if id := CorrelationFrom(ctx); id != "" {
		env.Rumera.CorrelationID = id
	}
}

// correlationKey is the context key for a request correlation id.
type correlationKey struct{}

// WithCorrelationID attaches a request correlation id to ctx.
func WithCorrelationID(ctx context.Context, id string) context.Context {
	if id == "" {
		return ctx
	}
	return context.WithValue(ctx, correlationKey{}, id)
}

// CorrelationFrom reads the request correlation id, if any.
func CorrelationFrom(ctx context.Context) string {
	if v, ok := ctx.Value(correlationKey{}).(string); ok {
		return v
	}
	return ""
}

// TraceContext rebuilds a trace context from an envelope so a consumer span
// becomes a child of the producing request.
func TraceContext(ctx context.Context, env *Envelope) context.Context {
	if env == nil || env.Rumera.Traceparent == "" {
		return ctx
	}
	carrier := propagation.MapCarrier{"traceparent": env.Rumera.Traceparent}
	return otel.GetTextMapPropagator().Extract(ctx, carrier)
}
