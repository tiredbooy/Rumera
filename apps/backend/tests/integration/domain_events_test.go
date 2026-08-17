//go:build integration

package integration

import (
	"context"
	"testing"
	"time"

	"github.com/tiredbooy/internal/events"
	eventspg "github.com/tiredbooy/internal/events/postgres"
)

func newEventStore() *eventspg.Store { return eventspg.NewStore(testPool) }

func resetEventTables(t *testing.T) {
	t.Helper()
	resetTables(t, "domain_events", "domain_event_consumptions")
}

func mustEnvelope(t *testing.T, orderID int64) *events.Envelope {
	t.Helper()
	env, err := events.New(
		events.TypeOrderPaidV1,
		"order:1",
		events.OrderPaidKey(orderID),
		events.OrderPaidData{OrderID: orderID, UserID: 7, Amount: 125.5, Rail: "gateway"},
	)
	if err != nil {
		t.Fatalf("build envelope: %v", err)
	}
	return env
}

func countEvents(t *testing.T) int {
	t.Helper()
	var n int
	if err := testPool.QueryRow(context.Background(),
		`SELECT count(*) FROM domain_events`).Scan(&n); err != nil {
		t.Fatalf("count domain_events: %v", err)
	}
	return n
}

// The entire reason the outbox lives in Postgres rather than being a direct
// Kafka publish: if the surrounding money transaction rolls back, the fact must
// vanish with it. A published-then-rolled-back event would tell consumers an
// order was paid when it was not.
func TestEnqueueTxRollsBackWithTheTransaction(t *testing.T) {
	requireDB(t)
	resetEventTables(t)

	ctx := context.Background()
	store := newEventStore()

	tx, err := testPool.Begin(ctx)
	if err != nil {
		t.Fatalf("begin: %v", err)
	}
	if err := store.EnqueueTx(ctx, tx, mustEnvelope(t, 1001)); err != nil {
		t.Fatalf("EnqueueTx: %v", err)
	}
	// The fact is visible inside the transaction…
	var inTx int
	if err := tx.QueryRow(ctx, `SELECT count(*) FROM domain_events`).Scan(&inTx); err != nil {
		t.Fatalf("count in tx: %v", err)
	}
	if inTx != 1 {
		t.Fatalf("in-transaction count = %d; want 1", inTx)
	}

	if err := tx.Rollback(ctx); err != nil {
		t.Fatalf("rollback: %v", err)
	}

	if got := countEvents(t); got != 0 {
		t.Errorf("after rollback %d facts survived; a fact must never outlive the transaction that produced it", got)
	}
}

func TestEnqueueTxCommitsWithTheTransaction(t *testing.T) {
	requireDB(t)
	resetEventTables(t)

	ctx := context.Background()
	store := newEventStore()

	tx, err := testPool.Begin(ctx)
	if err != nil {
		t.Fatalf("begin: %v", err)
	}
	if err := store.EnqueueTx(ctx, tx, mustEnvelope(t, 1002)); err != nil {
		t.Fatalf("EnqueueTx: %v", err)
	}
	if err := tx.Commit(ctx); err != nil {
		t.Fatalf("commit: %v", err)
	}

	if got := countEvents(t); got != 1 {
		t.Fatalf("after commit %d facts; want 1", got)
	}
}

// A replayed webhook, a double Confirm, or both rails firing for one order must
// collapse to a single fact — otherwise consumers award twice.
func TestDuplicateIdempotencyKeyIsANoOp(t *testing.T) {
	requireDB(t)
	resetEventTables(t)

	ctx := context.Background()
	store := newEventStore()

	for i := 0; i < 3; i++ {
		// Distinct envelope IDs, same business key.
		if err := store.Enqueue(ctx, mustEnvelope(t, 1003)); err != nil {
			t.Fatalf("Enqueue %d: %v", i, err)
		}
	}
	if got := countEvents(t); got != 1 {
		t.Errorf("stored %d facts for one order; the unique idempotency key must collapse them", got)
	}
}

// Two relay replicas must never publish the same row twice.
func TestClaimUnpublishedSkipsRowsLockedByAnotherWorker(t *testing.T) {
	requireDB(t)
	resetEventTables(t)

	ctx := context.Background()
	store := newEventStore()
	for i := int64(1); i <= 3; i++ {
		if err := store.Enqueue(ctx, mustEnvelope(t, 2000+i)); err != nil {
			t.Fatalf("Enqueue: %v", err)
		}
	}

	// Hold a lock on the whole table's unpublished rows from a second session,
	// mimicking a concurrent relay mid-batch.
	other, err := testPool.Begin(ctx)
	if err != nil {
		t.Fatalf("begin other: %v", err)
	}
	defer func() { _ = other.Rollback(ctx) }()

	if _, err := other.Exec(ctx,
		`SELECT id FROM domain_events WHERE published_at IS NULL FOR UPDATE`); err != nil {
		t.Fatalf("lock rows: %v", err)
	}

	claimed, err := store.ClaimUnpublished(ctx, 10)
	if err != nil {
		t.Fatalf("ClaimUnpublished: %v", err)
	}
	if len(claimed) != 0 {
		t.Errorf("claimed %d rows that another worker holds; SKIP LOCKED is not doing its job and rows would be double-published", len(claimed))
	}
}

func TestMarkPublishedIsNotReclaimed(t *testing.T) {
	requireDB(t)
	resetEventTables(t)

	ctx := context.Background()
	store := newEventStore()
	if err := store.Enqueue(ctx, mustEnvelope(t, 3001)); err != nil {
		t.Fatalf("Enqueue: %v", err)
	}

	claimed, err := store.ClaimUnpublished(ctx, 10)
	if err != nil || len(claimed) != 1 {
		t.Fatalf("first claim: %d rows, err %v", len(claimed), err)
	}
	if err := store.MarkPublished(ctx, claimed[0].PK); err != nil {
		t.Fatalf("MarkPublished: %v", err)
	}

	again, err := store.ClaimUnpublished(ctx, 10)
	if err != nil {
		t.Fatalf("second claim: %v", err)
	}
	if len(again) != 0 {
		t.Errorf("re-claimed %d published rows; they would be republished on every tick", len(again))
	}
}

// A permanently failing row previously stayed eligible on every tick and
// starved the batch behind it.
func TestPublishErrorBacksTheRowOff(t *testing.T) {
	requireDB(t)
	resetEventTables(t)

	ctx := context.Background()
	store := newEventStore()
	if err := store.Enqueue(ctx, mustEnvelope(t, 3002)); err != nil {
		t.Fatalf("Enqueue: %v", err)
	}
	claimed, err := store.ClaimUnpublished(ctx, 10)
	if err != nil || len(claimed) != 1 {
		t.Fatalf("claim: %d rows, err %v", len(claimed), err)
	}

	if err := store.MarkPublishError(ctx, claimed[0].PK, "broker down", time.Now().Add(time.Hour)); err != nil {
		t.Fatalf("MarkPublishError: %v", err)
	}

	again, err := store.ClaimUnpublished(ctx, 10)
	if err != nil {
		t.Fatalf("re-claim: %v", err)
	}
	if len(again) != 0 {
		t.Errorf("backed-off row was re-claimed immediately (%d rows); it would monopolise every batch", len(again))
	}
}

// End-to-end through the real store: fan out to two consumers, one succeeds and
// one fails, and only the failing one is left owed.
func TestFanOutAndConsumeAgainstPostgres(t *testing.T) {
	requireDB(t)
	resetEventTables(t)

	ctx := context.Background()
	store := newEventStore()

	reg := events.NewRegistry()
	okCalls := 0
	reg.Register(events.HandlerFunc{
		ConsumerName: "ok-consumer",
		EventTypes:   []string{events.TypeOrderPaidV1},
		Fn: func(context.Context, *events.Envelope) error {
			okCalls++
			return nil
		},
	})
	reg.Register(events.HandlerFunc{
		ConsumerName: "bad-consumer",
		EventTypes:   []string{events.TypeOrderPaidV1},
		Fn: func(context.Context, *events.Envelope) error {
			return events.Permanent(errNotConfigured)
		},
	})

	w := events.NewWorker(store, reg, nil, nil, nil, events.Config{
		MaxAttempts: 2, BackoffBase: time.Millisecond, BackoffMax: time.Millisecond,
	})

	env := mustEnvelope(t, 4001)
	if err := store.Enqueue(ctx, env); err != nil {
		t.Fatalf("Enqueue: %v", err)
	}

	n, err := w.FanOutOnce(ctx)
	if err != nil {
		t.Fatalf("FanOutOnce: %v", err)
	}
	if n != 1 {
		t.Fatalf("fanned out %d facts; want 1", n)
	}
	if _, err := w.ConsumeOnce(ctx); err != nil {
		t.Fatalf("ConsumeOnce: %v", err)
	}

	if okCalls != 1 {
		t.Errorf("healthy consumer ran %d times; want 1", okCalls)
	}
	assertStatus(t, env.ID, "ok-consumer", "done")
	assertStatus(t, env.ID, "bad-consumer", "dlq")

	// Fan-out must be idempotent: a second pass creates nothing new.
	if n, err := w.FanOutOnce(ctx); err != nil || n != 0 {
		t.Errorf("second fan-out returned %d (err %v); want 0", n, err)
	}

	// A dead-lettered consumption keeps its fact alive through retention.
	removed, err := store.Prune(ctx, time.Now().Add(time.Hour), 100)
	if err != nil {
		t.Fatalf("Prune: %v", err)
	}
	if removed != 0 {
		t.Errorf("pruned %d facts with an unsettled consumption; replay would be impossible", removed)
	}

	// Once the operator replays and it settles, the fact becomes prunable.
	if _, err := store.Replay(ctx, "bad-consumer", 10); err != nil {
		t.Fatalf("Replay: %v", err)
	}
	if err := store.MarkDone(ctx, env.ID, "bad-consumer"); err != nil {
		t.Fatalf("MarkDone: %v", err)
	}
	removed, err = store.Prune(ctx, time.Now().Add(time.Hour), 100)
	if err != nil {
		t.Fatalf("Prune after settle: %v", err)
	}
	if removed != 1 {
		t.Errorf("pruned %d fully-settled facts; want 1", removed)
	}
	if got := countEvents(t); got != 0 {
		t.Errorf("%d facts left after prune; want 0", got)
	}
}

func assertStatus(t *testing.T, eventID, consumer, want string) {
	t.Helper()
	var got string
	err := testPool.QueryRow(context.Background(),
		`SELECT status FROM domain_event_consumptions WHERE event_id = $1 AND consumer = $2`,
		eventID, consumer,
	).Scan(&got)
	if err != nil {
		t.Fatalf("load status for %s: %v", consumer, err)
	}
	if got != want {
		t.Errorf("%s status = %q; want %q", consumer, got, want)
	}
}

// errNotConfigured stands in for a permanent handler failure.
var errNotConfigured = &configError{}

type configError struct{}

func (*configError) Error() string { return "provider not configured" }

// The lease is the mutual-exclusion mechanism between concurrent consume loops.
// FOR UPDATE SKIP LOCKED alone is not enough: in a single autocommit statement
// the lock is released the moment the claim returns, so without pushing
// available_at forward the next loop re-claims a row whose handler is still
// running and the side effect happens twice.
func TestClaimDueLeaseExcludesConcurrentClaims(t *testing.T) {
	requireDB(t)
	resetEventTables(t)

	ctx := context.Background()
	store := newEventStore()
	reg := events.NewRegistry()
	reg.Register(events.HandlerFunc{
		ConsumerName: "leased",
		EventTypes:   []string{events.TypeOrderPaidV1},
		Fn:           func(context.Context, *events.Envelope) error { return nil },
	})
	w := events.NewWorker(store, reg, nil, nil, nil, events.Config{})

	if err := store.Enqueue(ctx, mustEnvelope(t, 5001)); err != nil {
		t.Fatalf("Enqueue: %v", err)
	}
	if _, err := w.FanOutOnce(ctx); err != nil {
		t.Fatalf("FanOutOnce: %v", err)
	}

	first, err := store.ClaimDue(ctx, 10, time.Minute)
	if err != nil {
		t.Fatalf("first ClaimDue: %v", err)
	}
	if len(first) != 1 {
		t.Fatalf("first claim got %d rows; want 1", len(first))
	}

	second, err := store.ClaimDue(ctx, 10, time.Minute)
	if err != nil {
		t.Fatalf("second ClaimDue: %v", err)
	}
	if len(second) != 0 {
		t.Errorf("a second loop claimed %d in-flight rows; the handler would run concurrently with itself", len(second))
	}

	// Simulate the lease expiring after a worker crashed mid-handler: the row
	// must become runnable again on its own, with no operator intervention.
	if _, err := testPool.Exec(ctx,
		`UPDATE domain_event_consumptions SET available_at = NOW() - INTERVAL '1 second'`,
	); err != nil {
		t.Fatalf("expire lease: %v", err)
	}
	again, err := store.ClaimDue(ctx, 10, time.Minute)
	if err != nil {
		t.Fatalf("post-expiry ClaimDue: %v", err)
	}
	if len(again) != 1 {
		t.Error("row never became runnable again; a crashed worker would strand it forever")
	}
}

// A settled row must be terminal so a straggler cannot resurrect it.
func TestSettleTransitionsAreTerminalInPostgres(t *testing.T) {
	requireDB(t)
	resetEventTables(t)

	ctx := context.Background()
	store := newEventStore()
	reg := events.NewRegistry()
	reg.Register(events.HandlerFunc{
		ConsumerName: "terminal",
		EventTypes:   []string{events.TypeOrderPaidV1},
		Fn:           func(context.Context, *events.Envelope) error { return nil },
	})
	w := events.NewWorker(store, reg, nil, nil, nil, events.Config{})

	env := mustEnvelope(t, 5002)
	if err := store.Enqueue(ctx, env); err != nil {
		t.Fatalf("Enqueue: %v", err)
	}
	if _, err := w.FanOutOnce(ctx); err != nil {
		t.Fatalf("FanOutOnce: %v", err)
	}
	if _, err := w.ConsumeOnce(ctx); err != nil {
		t.Fatalf("ConsumeOnce: %v", err)
	}
	assertStatus(t, env.ID, "terminal", "done")

	if err := store.MarkRetry(ctx, env.ID, "terminal", "stale straggler", time.Now()); err != nil {
		t.Fatalf("MarkRetry: %v", err)
	}
	assertStatus(t, env.ID, "terminal", "done")

	if err := store.MarkDLQ(ctx, env.ID, "terminal", "stale straggler"); err != nil {
		t.Fatalf("MarkDLQ: %v", err)
	}
	assertStatus(t, env.ID, "terminal", "done")
}

// A fact nothing has fanned out yet must survive retention: "no unfinished
// consumptions" is vacuously true when there are no consumptions at all.
func TestPruneKeepsNeverDispatchedFacts(t *testing.T) {
	requireDB(t)
	resetEventTables(t)

	ctx := context.Background()
	store := newEventStore()
	if err := store.Enqueue(ctx, mustEnvelope(t, 5003)); err != nil {
		t.Fatalf("Enqueue: %v", err)
	}

	removed, err := store.Prune(ctx, time.Now().Add(time.Hour), 100)
	if err != nil {
		t.Fatalf("Prune: %v", err)
	}
	if removed != 0 {
		t.Errorf("pruned %d never-dispatched facts; their side effects would be lost silently", removed)
	}
	if got := countEvents(t); got != 1 {
		t.Errorf("%d facts left; the undelivered fact was deleted", got)
	}
}
