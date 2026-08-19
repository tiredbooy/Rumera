package events

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sync/atomic"
	"testing"
	"time"
)

// newTestWorker builds a worker whose loops are never started — tests drive
// FanOutOnce/ConsumeOnce directly so there is nothing to sleep on.
func newTestWorker(t *testing.T, store Store, cfg Config, handlers ...Handler) *Worker {
	t.Helper()
	reg := NewRegistry()
	for _, h := range handlers {
		reg.Register(h)
	}
	return NewWorker(store, reg, nil, nil, nil, cfg)
}

func mustEnqueue(t *testing.T, store Store, eventType, subject, key string, data any) *Envelope {
	t.Helper()
	env, err := New(eventType, subject, key, data)
	if err != nil {
		t.Fatalf("New envelope: %v", err)
	}
	if err := store.Enqueue(context.Background(), env); err != nil {
		t.Fatalf("Enqueue: %v", err)
	}
	return env
}

// countingHandler records calls and returns a scripted error sequence.
type countingHandler struct {
	name   string
	types  []string
	calls  atomic.Int32
	errsBy func(call int) error
}

func (h *countingHandler) Name() string    { return h.name }
func (h *countingHandler) Types() []string { return h.types }
func (h *countingHandler) Handle(_ context.Context, _ *Envelope) error {
	n := int(h.calls.Add(1))
	if h.errsBy == nil {
		return nil
	}
	return h.errsBy(n)
}

func TestWorkerDeliversEachFactOncePerConsumer(t *testing.T) {
	store := NewMemoryStore()
	a := &countingHandler{name: "a", types: []string{TypeOrderPaidV1}}
	b := &countingHandler{name: "b", types: []string{TypeOrderPaidV1}}
	w := newTestWorker(t, store, Config{}, a, b)

	env := mustEnqueue(t, store, TypeOrderPaidV1, "order:1", OrderPaidKey(1),
		OrderPaidData{OrderID: 1, UserID: 7, Amount: 100})

	if _, err := w.FanOutOnce(context.Background()); err != nil {
		t.Fatalf("FanOutOnce: %v", err)
	}
	if _, err := w.ConsumeOnce(context.Background()); err != nil {
		t.Fatalf("ConsumeOnce: %v", err)
	}

	if got := a.calls.Load(); got != 1 {
		t.Errorf("consumer a called %d times; want 1", got)
	}
	if got := b.calls.Load(); got != 1 {
		t.Errorf("consumer b called %d times; want 1", got)
	}
	for _, name := range []string{"a", "b"} {
		if s := store.Status(env.ID, name); s != StatusDone {
			t.Errorf("consumer %s status = %q; want %q", name, s, StatusDone)
		}
	}

	// A second pass must be a no-op: settled rows are not re-claimed.
	if _, err := w.ConsumeOnce(context.Background()); err != nil {
		t.Fatalf("second ConsumeOnce: %v", err)
	}
	if got := a.calls.Load(); got != 1 {
		t.Errorf("consumer a re-ran (%d calls); at-least-once delivery must be exactly-once effect", got)
	}
}

func TestWorkerRetriesThenSucceeds(t *testing.T) {
	store := NewMemoryStore()
	h := &countingHandler{
		name:  "flaky",
		types: []string{TypeOrderPaidV1},
		errsBy: func(call int) error {
			if call == 1 {
				return errors.New("smtp unavailable")
			}
			return nil
		},
	}
	w := newTestWorker(t, store, Config{BackoffBase: time.Millisecond, BackoffMax: time.Millisecond}, h)
	env := mustEnqueue(t, store, TypeOrderPaidV1, "order:2", OrderPaidKey(2), OrderPaidData{OrderID: 2})

	ctx := context.Background()
	if _, err := w.FanOutOnce(ctx); err != nil {
		t.Fatalf("FanOutOnce: %v", err)
	}

	// First pass fails and must be scheduled for retry, not dropped or settled.
	if _, err := w.ConsumeOnce(ctx); err != nil {
		t.Fatalf("ConsumeOnce: %v", err)
	}
	if s := store.Status(env.ID, "flaky"); s != StatusRetry {
		t.Fatalf("after failure status = %q; want %q", s, StatusRetry)
	}
	if e := store.LastError(env.ID, "flaky"); e == "" {
		t.Error("failure recorded no last_error; an operator cannot diagnose a silent retry")
	}

	store.MakeDue(env.ID, "flaky")
	if _, err := w.ConsumeOnce(ctx); err != nil {
		t.Fatalf("retry ConsumeOnce: %v", err)
	}
	if s := store.Status(env.ID, "flaky"); s != StatusDone {
		t.Fatalf("after retry status = %q; want %q", s, StatusDone)
	}
	if got := h.calls.Load(); got != 2 {
		t.Errorf("handler called %d times; want 2 (fail then succeed)", got)
	}
}

func TestWorkerDeadLettersAfterMaxAttempts(t *testing.T) {
	store := NewMemoryStore()
	h := &countingHandler{
		name:   "always-fails",
		types:  []string{TypeOrderPaidV1},
		errsBy: func(int) error { return errors.New("nope") },
	}
	const maxAttempts = 3
	w := newTestWorker(t, store, Config{
		MaxAttempts: maxAttempts,
		BackoffBase: time.Millisecond,
		BackoffMax:  time.Millisecond,
	}, h)
	env := mustEnqueue(t, store, TypeOrderPaidV1, "order:3", OrderPaidKey(3), OrderPaidData{OrderID: 3})

	ctx := context.Background()
	if _, err := w.FanOutOnce(ctx); err != nil {
		t.Fatalf("FanOutOnce: %v", err)
	}
	for i := 0; i < maxAttempts+2; i++ {
		store.MakeDue(env.ID, "always-fails")
		if _, err := w.ConsumeOnce(ctx); err != nil {
			t.Fatalf("ConsumeOnce %d: %v", i, err)
		}
	}

	if s := store.Status(env.ID, "always-fails"); s != StatusDLQ {
		t.Fatalf("status = %q; want %q after exhausting the retry budget", s, StatusDLQ)
	}
	// The budget must actually bound the work — a runaway retry loop would keep
	// hammering a dead dependency forever.
	if got := int(h.calls.Load()); got > maxAttempts {
		t.Errorf("handler called %d times; retry budget of %d was not enforced", got, maxAttempts)
	}
}

func TestWorkerDeadLettersPermanentFailureImmediately(t *testing.T) {
	store := NewMemoryStore()
	h := &countingHandler{
		name:   "bad-payload",
		types:  []string{TypeOrderPaidV1},
		errsBy: func(int) error { return Permanent(errors.New("unsupported schema")) },
	}
	w := newTestWorker(t, store, Config{MaxAttempts: 8, BackoffBase: time.Millisecond}, h)
	env := mustEnqueue(t, store, TypeOrderPaidV1, "order:4", OrderPaidKey(4), OrderPaidData{OrderID: 4})

	ctx := context.Background()
	if _, err := w.FanOutOnce(ctx); err != nil {
		t.Fatalf("FanOutOnce: %v", err)
	}
	if _, err := w.ConsumeOnce(ctx); err != nil {
		t.Fatalf("ConsumeOnce: %v", err)
	}

	if s := store.Status(env.ID, "bad-payload"); s != StatusDLQ {
		t.Fatalf("status = %q; want %q — a permanent failure must skip the retry budget", s, StatusDLQ)
	}
	if got := h.calls.Load(); got != 1 {
		t.Errorf("handler called %d times; a permanent failure must not be retried", got)
	}
}

func TestWorkerRecoversFromHandlerPanic(t *testing.T) {
	store := NewMemoryStore()
	reg := NewRegistry()
	reg.Register(HandlerFunc{
		ConsumerName: "panics",
		EventTypes:   []string{TypeOrderPaidV1},
		Fn: func(context.Context, *Envelope) error {
			panic("boom")
		},
	})
	w := NewWorker(store, reg, nil, nil, nil, Config{MaxAttempts: 3})
	env := mustEnqueue(t, store, TypeOrderPaidV1, "order:5", OrderPaidKey(5), OrderPaidData{OrderID: 5})

	ctx := context.Background()
	if _, err := w.FanOutOnce(ctx); err != nil {
		t.Fatalf("FanOutOnce: %v", err)
	}
	// Must not take the process down with it.
	if _, err := w.ConsumeOnce(ctx); err != nil {
		t.Fatalf("ConsumeOnce: %v", err)
	}
	if s := store.Status(env.ID, "panics"); s != StatusDLQ {
		t.Errorf("status = %q; want %q — a panicking handler is permanently broken", s, StatusDLQ)
	}
}

func TestReplayRevivesDeadLetteredRows(t *testing.T) {
	store := NewMemoryStore()
	fail := true
	reg := NewRegistry()
	reg.Register(HandlerFunc{
		ConsumerName: "recovering",
		EventTypes:   []string{TypeOrderPaidV1},
		Fn: func(context.Context, *Envelope) error {
			if fail {
				return Permanent(errors.New("provider misconfigured"))
			}
			return nil
		},
	})
	w := NewWorker(store, reg, nil, nil, nil, Config{MaxAttempts: 2, BackoffBase: time.Millisecond})
	env := mustEnqueue(t, store, TypeOrderPaidV1, "order:6", OrderPaidKey(6), OrderPaidData{OrderID: 6})

	ctx := context.Background()
	_, _ = w.FanOutOnce(ctx)
	_, _ = w.ConsumeOnce(ctx)
	if s := store.Status(env.ID, "recovering"); s != StatusDLQ {
		t.Fatalf("setup: status = %q; want %q", s, StatusDLQ)
	}

	// Operator fixes the config and replays.
	fail = false
	n, err := store.Replay(ctx, "recovering", 100)
	if err != nil {
		t.Fatalf("Replay: %v", err)
	}
	if n != 1 {
		t.Fatalf("Replay revived %d rows; want 1", n)
	}
	if _, err := w.ConsumeOnce(ctx); err != nil {
		t.Fatalf("post-replay ConsumeOnce: %v", err)
	}
	if s := store.Status(env.ID, "recovering"); s != StatusDone {
		t.Errorf("after replay status = %q; want %q", s, StatusDone)
	}
}

func TestDuplicateIdempotencyKeyEnqueuesOneFact(t *testing.T) {
	store := NewMemoryStore()
	ctx := context.Background()
	// Both rails emitting for the same order, or a replayed webhook.
	for i := 0; i < 3; i++ {
		mustEnqueue(t, store, TypeOrderPaidV1, "order:9", OrderPaidKey(9),
			OrderPaidData{OrderID: 9, UserID: 1, Amount: 50})
	}
	if got := store.EventCount(); got != 1 {
		t.Fatalf("stored %d facts; want 1 — the order-keyed idempotency key must collapse duplicates", got)
	}

	h := &countingHandler{name: "once", types: []string{TypeOrderPaidV1}}
	w := newTestWorker(t, store, Config{}, h)
	_, _ = w.FanOutOnce(ctx)
	_, _ = w.ConsumeOnce(ctx)
	if got := h.calls.Load(); got != 1 {
		t.Errorf("handler ran %d times for a duplicated fact; want 1", got)
	}
}

func TestFanOutOnlyToInterestedConsumers(t *testing.T) {
	store := NewMemoryStore()
	paid := &countingHandler{name: "paid-only", types: []string{TypeOrderPaidV1}}
	other := &countingHandler{name: "ping-only", types: []string{TypeTestPingV1}}
	w := newTestWorker(t, store, Config{}, paid, other)

	env := mustEnqueue(t, store, TypeOrderPaidV1, "order:10", OrderPaidKey(10), OrderPaidData{OrderID: 10})
	ctx := context.Background()
	_, _ = w.FanOutOnce(ctx)
	_, _ = w.ConsumeOnce(ctx)

	if got := paid.calls.Load(); got != 1 {
		t.Errorf("subscribed consumer ran %d times; want 1", got)
	}
	if got := other.calls.Load(); got != 0 {
		t.Errorf("unsubscribed consumer ran %d times; want 0", got)
	}
	if s := store.Status(env.ID, "ping-only"); s != "" {
		t.Errorf("unsubscribed consumer got a ledger row (%q); fan-out must filter by type", s)
	}
}

// K-4. In Kafka mode the fan-out is a fallback, not the primary path: while the
// broker is healthy it must claim nothing, or every fact is delivered twice.
func TestKafkaFanOutHoldsBackFreshFacts(t *testing.T) {
	store := NewMemoryStore()
	h := &countingHandler{name: "paid", types: []string{TypeOrderPaidV1}}
	w := newTestWorker(t, store, Config{Bus: BusKafka, FallbackAfter: time.Hour}, h)

	mustEnqueue(t, store, TypeOrderPaidV1, "order:20", OrderPaidKey(20), OrderPaidData{OrderID: 20})
	ctx := context.Background()

	n, err := w.FanOutOnce(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if n != 0 {
		t.Fatalf("fanned out %d fresh facts in kafka mode; want 0 — the broker has not had its window yet", n)
	}
	_, _ = w.ConsumeOnce(ctx)
	if got := h.calls.Load(); got != 0 {
		t.Errorf("consumer ran %d times off the fallback path; kafka would deliver this again", got)
	}
}

// ...but once the fact is older than the window, the fallback must engage. This
// is the property the single-broker decision rests on: a broker outage delays
// order.paid side effects, it does not stop them.
func TestKafkaFanOutEngagesOnceFactIsStale(t *testing.T) {
	store := NewMemoryStore()
	h := &countingHandler{name: "paid", types: []string{TypeOrderPaidV1}}
	w := newTestWorker(t, store, Config{Bus: BusKafka, FallbackAfter: time.Millisecond}, h)

	mustEnqueue(t, store, TypeOrderPaidV1, "order:21", OrderPaidKey(21), OrderPaidData{OrderID: 21})
	time.Sleep(20 * time.Millisecond)
	ctx := context.Background()

	n, err := w.FanOutOnce(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if n != 1 {
		t.Fatalf("fanned out %d stale facts; want 1 — a broker outage must not strand the fact", n)
	}
	_, _ = w.ConsumeOnce(ctx)
	if got := h.calls.Load(); got != 1 {
		t.Errorf("consumer ran %d times; want 1", got)
	}
}

// A fact Kafka did deliver is marked dispatched on ingest (K-2), so the fallback
// must skip it even after the window elapses — otherwise every fact runs twice
// during any period where both paths are live.
func TestKafkaFallbackSkipsFactsAlreadyIngested(t *testing.T) {
	store := NewMemoryStore()
	h := &countingHandler{name: "paid", types: []string{TypeOrderPaidV1}}
	w := newTestWorker(t, store, Config{Bus: BusKafka, FallbackAfter: time.Millisecond}, h)

	ctx := context.Background()
	env := mustEnqueue(t, store, TypeOrderPaidV1, "order:22", OrderPaidKey(22), OrderPaidData{OrderID: 22})
	if err := w.Ingest(ctx, env); err != nil {
		t.Fatal(err)
	}
	time.Sleep(20 * time.Millisecond)

	if n, err := w.FanOutOnce(ctx); err != nil || n != 0 {
		t.Fatalf("fallback claimed %d already-delivered facts (err=%v); want 0", n, err)
	}
	_, _ = w.ConsumeOnce(ctx)
	if got := h.calls.Load(); got != 1 {
		t.Errorf("consumer ran %d times; want exactly 1 (the kafka delivery)", got)
	}
}

// Postgres mode is the primary path and must not inherit the delay.
func TestPostgresFanOutIsImmediate(t *testing.T) {
	store := NewMemoryStore()
	h := &countingHandler{name: "paid", types: []string{TypeOrderPaidV1}}
	w := newTestWorker(t, store, Config{Bus: BusPostgres, FallbackAfter: time.Hour}, h)

	mustEnqueue(t, store, TypeOrderPaidV1, "order:23", OrderPaidKey(23), OrderPaidData{OrderID: 23})
	if n, err := w.FanOutOnce(context.Background()); err != nil || n != 1 {
		t.Fatalf("postgres fan-out claimed %d (err=%v); want 1 — FallbackAfter must not gate the primary path", n, err)
	}
}

// recordingObserver captures the gauges a metrics pass publishes.
type recordingObserver struct {
	lag        time.Duration
	relayLag   time.Duration
	relayCalls int
}

func (o *recordingObserver) Consumed(string, string, string, time.Duration) {}
func (o *recordingObserver) Retried(string, string)                         {}
func (o *recordingObserver) DeadLettered(string, string)                    {}
func (o *recordingObserver) Published(string, string)                       {}
func (o *recordingObserver) Depth(string, int64)                            {}
func (o *recordingObserver) Lag(d time.Duration)                            { o.lag = d }
func (o *recordingObserver) RelayLag(d time.Duration)                       { o.relayLag = d; o.relayCalls++ }

// K-3, the exact blind spot: with the broker down nothing is published and no
// consumption rows are ever created, so the outbox gauge — derived from those
// rows — reads 0 during a total ingest failure. The relay gauge must not.
func TestRelayLagMovesWhenOutboxLagIsBlind(t *testing.T) {
	store := NewMemoryStore()
	mustEnqueue(t, store, TypeOrderPaidV1, "order:30", OrderPaidKey(30), OrderPaidData{OrderID: 30})
	time.Sleep(20 * time.Millisecond)
	ctx := context.Background()

	// No fan-out has run, mirroring a broker that never delivered the fact back.
	outboxLag, err := store.OldestPendingAge(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if outboxLag != 0 {
		t.Fatalf("precondition: outbox lag = %v, want 0 (no consumption rows exist)", outboxLag)
	}

	relayLag, err := store.OldestUnpublishedAge(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if relayLag <= 0 {
		t.Fatal("relay lag = 0 while a fact sits unpublished — the gauge is blind to the failure it exists to catch")
	}
}

func TestRelayLagIsSampledOnlyOnTheKafkaBus(t *testing.T) {
	for _, tc := range []struct {
		bus  string
		want int
	}{
		{BusKafka, 1},
		// published_at is never set on the postgres path (K-10), so sampling there
		// would report the age of the oldest fact ever and page on a healthy system.
		{BusPostgres, 0},
	} {
		store := NewMemoryStore()
		mustEnqueue(t, store, TypeOrderPaidV1, "order:31", OrderPaidKey(31), OrderPaidData{OrderID: 31})
		obs := &recordingObserver{}
		h := &countingHandler{name: "paid", types: []string{TypeOrderPaidV1}}
		reg := NewRegistry()
		reg.Register(h)
		w := NewWorker(store, reg, nil, nil, obs, Config{Bus: tc.bus})

		w.SampleMetrics(context.Background())

		if obs.relayCalls != tc.want {
			t.Errorf("bus %s: RelayLag sampled %d times, want %d", tc.bus, obs.relayCalls, tc.want)
		}
	}
}

func TestBackoffGrowsAndIsCapped(t *testing.T) {
	base := time.Second
	max := 10 * time.Second

	// Jitter is up to +20%, so compare against the un-jittered floor.
	cases := []struct {
		attempt  int
		minFloor time.Duration
	}{
		{1, base},
		{2, 2 * base},
		{3, 4 * base},
	}
	for _, tc := range cases {
		got := Backoff(tc.attempt, base, max)
		if got < tc.minFloor {
			t.Errorf("Backoff(%d) = %s; want >= %s", tc.attempt, got, tc.minFloor)
		}
		if got > max+max/5 {
			t.Errorf("Backoff(%d) = %s; must not exceed max+jitter (%s)", tc.attempt, got, max+max/5)
		}
	}

	// A large attempt count must saturate, not overflow into a negative or
	// absurd duration that would park a row past the heat death of the universe.
	for _, attempt := range []int{40, 1000, 1 << 20} {
		got := Backoff(attempt, base, max)
		if got <= 0 {
			t.Errorf("Backoff(%d) = %s; must stay positive", attempt, got)
		}
		if got > max+max/5 {
			t.Errorf("Backoff(%d) = %s; must be capped at max+jitter", attempt, got)
		}
	}
}

func TestRelayPublishesAndBacksOffOnFailure(t *testing.T) {
	store := NewMemoryStore()
	reg := NewRegistry()
	reg.Register(&countingHandler{name: "noop", types: []string{TypeOrderPaidV1}})

	pub := &recordingPublisher{}
	w := NewWorker(store, reg, nil, pub, nil, Config{
		Bus: BusKafka, RelayBatch: 10, BackoffBase: time.Hour, BackoffMax: time.Hour,
	})
	mustEnqueue(t, store, TypeOrderPaidV1, "order:11", OrderPaidKey(11), OrderPaidData{OrderID: 11})

	ctx := context.Background()
	n, err := w.RelayOnce(ctx)
	if err != nil {
		t.Fatalf("RelayOnce: %v", err)
	}
	if n != 1 {
		t.Fatalf("published %d; want 1", n)
	}
	if len(pub.msgs) != 1 {
		t.Fatalf("publisher saw %d messages; want 1", len(pub.msgs))
	}
	if pub.msgs[0].topic != TopicFor(TypeOrderPaidV1) {
		t.Errorf("topic = %q; want %q", pub.msgs[0].topic, TopicFor(TypeOrderPaidV1))
	}
	if pub.msgs[0].key != "order:11" {
		t.Errorf("partition key = %q; want the subject so one order stays ordered", pub.msgs[0].key)
	}
	var decoded Envelope
	if err := json.Unmarshal(pub.msgs[0].value, &decoded); err != nil {
		t.Fatalf("published payload is not a valid envelope: %v", err)
	}
	if decoded.Rumera.IdempotencyKey != OrderPaidKey(11) {
		t.Errorf("idempotency key lost in transit: %q", decoded.Rumera.IdempotencyKey)
	}

	// Already published: must not be re-claimed.
	if n, err := w.RelayOnce(ctx); err != nil || n != 0 {
		t.Errorf("second RelayOnce published %d (err %v); want 0", n, err)
	}

	// A publish failure must back the row off rather than spin on it.
	pub.fail = errors.New("broker down")
	mustEnqueue(t, store, TypeOrderPaidV1, "order:12", OrderPaidKey(12), OrderPaidData{OrderID: 12})
	if n, err := w.RelayOnce(ctx); err != nil || n != 0 {
		t.Fatalf("RelayOnce with failing broker published %d (err %v); want 0", n, err)
	}
	if n, err := w.RelayOnce(ctx); err != nil || n != 0 {
		t.Errorf("failed row was re-claimed immediately (%d published); it must back off so it cannot starve the batch", n)
	}
}

type publishedMsg struct {
	topic, key string
	value      []byte
}

type recordingPublisher struct {
	msgs []publishedMsg
	fail error
}

func (p *recordingPublisher) Publish(_ context.Context, topic, key string, value []byte) error {
	if p.fail != nil {
		return p.fail
	}
	p.msgs = append(p.msgs, publishedMsg{topic, key, append([]byte(nil), value...)})
	return nil
}

func TestIngestIsIdempotent(t *testing.T) {
	store := NewMemoryStore()
	h := &countingHandler{name: "once", types: []string{TypeOrderPaidV1}}
	w := newTestWorker(t, store, Config{}, h)

	env := mustEnqueue(t, store, TypeOrderPaidV1, "order:13", OrderPaidKey(13), OrderPaidData{OrderID: 13})
	ctx := context.Background()

	// Simulate a Kafka redelivery / rebalance: the same envelope arrives twice.
	for i := 0; i < 3; i++ {
		if err := w.Ingest(ctx, env); err != nil {
			t.Fatalf("Ingest %d: %v", i, err)
		}
	}
	if _, err := w.ConsumeOnce(ctx); err != nil {
		t.Fatalf("ConsumeOnce: %v", err)
	}
	if got := h.calls.Load(); got != 1 {
		t.Errorf("handler ran %d times after 3 deliveries; want 1", got)
	}
}

func TestKafkaIngestHandlerClassifiesFailures(t *testing.T) {
	h := &KafkaIngestHandler{Worker: stubIngester{}}

	// Poison payload → permanent, so the consumer DLQs instead of spinning.
	done, err := h.Handle(context.Background(), "t", []byte("{not json"))
	if !done || err == nil {
		t.Errorf("malformed payload: got (done=%v, err=%v); want (true, non-nil)", done, err)
	}

	// Ledger write failure → retryable, and must NOT commit or the fact is lost.
	h2 := &KafkaIngestHandler{Worker: stubIngester{err: errors.New("db down")}}
	env, _ := New(TypeOrderPaidV1, "order:1", OrderPaidKey(1), OrderPaidData{OrderID: 1})
	raw, _ := json.Marshal(env)
	done, err = h2.Handle(context.Background(), "t", raw)
	if done || err == nil {
		t.Errorf("ledger failure: got (done=%v, err=%v); want (false, non-nil) so the offset is not committed", done, err)
	}
}

type stubIngester struct{ err error }

func (s stubIngester) Ingest(context.Context, *Envelope) error { return s.err }

func TestPruneKeepsUnsettledFacts(t *testing.T) {
	store := NewMemoryStore()
	h := &countingHandler{
		name:   "stuck",
		types:  []string{TypeOrderPaidV1},
		errsBy: func(int) error { return Permanent(errors.New("broken")) },
	}
	w := newTestWorker(t, store, Config{MaxAttempts: 1}, h)

	env := mustEnqueue(t, store, TypeOrderPaidV1, "order:14", OrderPaidKey(14), OrderPaidData{OrderID: 14})
	// Backdate so it is unambiguously past any retention horizon.
	env.Time = time.Now().Add(-100 * 24 * time.Hour)

	ctx := context.Background()
	_, _ = w.FanOutOnce(ctx)
	_, _ = w.ConsumeOnce(ctx)
	if s := store.Status(env.ID, "stuck"); s != StatusDLQ {
		t.Fatalf("setup: status = %q; want %q", s, StatusDLQ)
	}

	n, err := store.Prune(ctx, time.Now(), 100)
	if err != nil {
		t.Fatalf("Prune: %v", err)
	}
	if n != 0 {
		t.Errorf("pruned %d rows; a dead-lettered fact must survive retention so it stays replayable", n)
	}
	if store.EventCount() != 1 {
		t.Error("the fact behind a dead-lettered consumption was deleted; replay is now impossible")
	}
}

func TestRegistryRejectsDuplicateConsumerNames(t *testing.T) {
	reg := NewRegistry()
	reg.Register(&countingHandler{name: "dup", types: []string{TypeOrderPaidV1}})

	defer func() {
		if recover() == nil {
			t.Error("registering a duplicate consumer name did not panic; the second would silently shadow the first")
		}
	}()
	reg.Register(&countingHandler{name: "dup", types: []string{TypeOrderPaidV1}})
}

func TestEnvelopeRoundTripPreservesMeta(t *testing.T) {
	env, err := New(TypeOrderPaidV1, "order:42", OrderPaidKey(42), OrderPaidData{
		OrderID: 42, UserID: 7, Amount: 1250.5, Rail: "wallet",
	})
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	env.WithCorrelation("req-abc", "00-trace-span-01")

	raw, err := json.Marshal(env)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	var back Envelope
	if err := json.Unmarshal(raw, &back); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	if back.Rumera.IdempotencyKey != env.Rumera.IdempotencyKey {
		t.Errorf("idempotency key = %q; want %q", back.Rumera.IdempotencyKey, env.Rumera.IdempotencyKey)
	}
	if back.Rumera.CorrelationID != "req-abc" || back.Rumera.Traceparent != "00-trace-span-01" {
		t.Errorf("correlation/trace lost: %+v", back.Rumera)
	}
	if back.Subject != "order:42" {
		t.Errorf("subject = %q; want order:42", back.Subject)
	}
	if back.SpecVersion != SpecVersion {
		t.Errorf("specversion = %q; want %q", back.SpecVersion, SpecVersion)
	}

	var data OrderPaidData
	if err := back.UnmarshalData(&data); err != nil {
		t.Fatalf("UnmarshalData: %v", err)
	}
	if data.OrderID != 42 || data.Amount != 1250.5 || data.Rail != "wallet" {
		t.Errorf("payload round-trip lost data: %+v", data)
	}
}

func TestNewRejectsMissingIdentity(t *testing.T) {
	cases := []struct {
		name, eventType, key string
	}{
		{"no type", "", "k"},
		{"no idempotency key", TypeOrderPaidV1, ""},
		{"blank idempotency key", TypeOrderPaidV1, "   "},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if _, err := New(tc.eventType, "s", tc.key, nil); err == nil {
				t.Error("want an error; an unkeyed fact would defeat outbox deduplication")
			}
		})
	}
}

func TestTopicRoutingIsFailOpen(t *testing.T) {
	// The whole point: an unregistered type must NOT error, because routing runs
	// inside an open money transaction and an error there rolls back a settled
	// payment.
	got := TopicFor("some.brand.new.type.v9")
	if got == "" {
		t.Fatal("TopicFor returned an empty topic for an unknown type")
	}
	if got != TopicFor(TypeOrderPaidV1) {
		t.Errorf("unknown type routed to %q; want the default topic %q", got, TopicFor(TypeOrderPaidV1))
	}
}

func TestOrderPaidKeyIsStablePerOrder(t *testing.T) {
	// Both rails must produce the same key for one order, or a wallet checkout
	// and a gateway confirm could each emit a fact and double-award.
	if OrderPaidKey(77) != OrderPaidKey(77) {
		t.Fatal("key is not deterministic")
	}
	if OrderPaidKey(77) == OrderPaidKey(78) {
		t.Fatal("different orders share an idempotency key")
	}
	if want := fmt.Sprintf("order:%d:paid", 77); OrderPaidKey(77) != want {
		t.Errorf("OrderPaidKey(77) = %q; want %q", OrderPaidKey(77), want)
	}
}

func TestEmitterDisabledIsNoOp(t *testing.T) {
	store := NewMemoryStore()
	e := NewEmitter(store, false)
	if e.Enabled() {
		t.Fatal("Enabled() true for a disabled emitter")
	}
	// Must not error — producers call this inside a money transaction and an
	// error would roll the payment back.
	if err := e.OrderPaidTx(context.Background(), nil, OrderPaidData{OrderID: 1, UserID: 1}); err != nil {
		t.Errorf("disabled emitter returned %v; want nil so it cannot fail a checkout", err)
	}
	if store.EventCount() != 0 {
		t.Error("disabled emitter still wrote a fact")
	}
}

func TestEmitterRejectsFactWithoutOrder(t *testing.T) {
	e := NewEmitter(NewMemoryStore(), true)
	if err := e.OrderPaidTx(context.Background(), nil, OrderPaidData{OrderID: 0}); err == nil {
		t.Error("want an error for an order-less order.paid fact")
	}
}

// The lease is what provides mutual exclusion between the concurrent consume
// loops. Without it, FOR UPDATE SKIP LOCKED releases at the end of the claim
// statement and the next loop re-claims a row whose handler is still running.
func TestClaimDueLeaseHidesInFlightRows(t *testing.T) {
	store := NewMemoryStore()
	h := &countingHandler{name: "slow", types: []string{TypeOrderPaidV1}}
	w := newTestWorker(t, store, Config{}, h)

	env := mustEnqueue(t, store, TypeOrderPaidV1, "order:20", OrderPaidKey(20), OrderPaidData{OrderID: 20})
	ctx := context.Background()
	if _, err := w.FanOutOnce(ctx); err != nil {
		t.Fatalf("FanOutOnce: %v", err)
	}

	first, err := store.ClaimDue(ctx, 10, time.Minute)
	if err != nil {
		t.Fatalf("first ClaimDue: %v", err)
	}
	if len(first) != 1 {
		t.Fatalf("first claim returned %d rows; want 1", len(first))
	}

	// A second loop claiming immediately afterwards must see nothing.
	second, err := store.ClaimDue(ctx, 10, time.Minute)
	if err != nil {
		t.Fatalf("second ClaimDue: %v", err)
	}
	if len(second) != 0 {
		t.Errorf("second claim returned %d rows while the first is still in flight; "+
			"the handler would run concurrently with itself and send twice", len(second))
	}

	// Once the lease expires the row is runnable again — that is what makes a
	// crashed worker self-healing rather than permanently stuck.
	store.MakeDue(env.ID, "slow")
	third, err := store.ClaimDue(ctx, 10, time.Minute)
	if err != nil {
		t.Fatalf("third ClaimDue: %v", err)
	}
	if len(third) != 1 {
		t.Errorf("row was not runnable after its lease expired; a crashed worker would strand it forever")
	}
}

// A settled row must be terminal, or a straggler from a duplicate claim can
// move it backwards and cause the handler to run again.
func TestSettledConsumptionIsTerminal(t *testing.T) {
	store := NewMemoryStore()
	h := &countingHandler{name: "c", types: []string{TypeOrderPaidV1}}
	w := newTestWorker(t, store, Config{}, h)

	env := mustEnqueue(t, store, TypeOrderPaidV1, "order:21", OrderPaidKey(21), OrderPaidData{OrderID: 21})
	ctx := context.Background()
	_, _ = w.FanOutOnce(ctx)
	_, _ = w.ConsumeOnce(ctx)
	if s := store.Status(env.ID, "c"); s != StatusDone {
		t.Fatalf("setup: status = %q; want done", s)
	}

	// A late loser tries to reschedule the row it also claimed.
	if err := store.MarkRetry(ctx, env.ID, "c", "stale", time.Now()); err != nil {
		t.Fatalf("MarkRetry: %v", err)
	}
	if s := store.Status(env.ID, "c"); s != StatusDone {
		t.Errorf("a straggler moved a settled row to %q; the handler would run again", s)
	}
	if err := store.MarkDLQ(ctx, env.ID, "c", "stale"); err != nil {
		t.Fatalf("MarkDLQ: %v", err)
	}
	if s := store.Status(env.ID, "c"); s != StatusDone {
		t.Errorf("a straggler dead-lettered a successfully handled row (%q)", s)
	}
}

// A fact with no consumption rows has never been fanned out. It must not be
// mistaken for "fully settled" and deleted.
func TestPruneKeepsNeverFannedOutFacts(t *testing.T) {
	store := NewMemoryStore()
	env := mustEnqueue(t, store, TypeOrderPaidV1, "order:22", OrderPaidKey(22), OrderPaidData{OrderID: 22})
	env.Time = time.Now().Add(-100 * 24 * time.Hour)

	n, err := store.Prune(context.Background(), time.Now(), 100)
	if err != nil {
		t.Fatalf("Prune: %v", err)
	}
	if n != 0 {
		t.Errorf("pruned %d never-dispatched facts; their side effects would be lost silently", n)
	}
	if store.EventCount() != 1 {
		t.Error("a fact that no consumer had seen yet was deleted")
	}
}

// leaseSpy records the visibility timeout ConsumeOnce claims with.
type leaseSpy struct {
	Store
	lease time.Duration
}

func (s *leaseSpy) ClaimDue(ctx context.Context, limit int, lease time.Duration) ([]Due, error) {
	s.lease = lease
	return s.Store.ClaimDue(ctx, limit, lease)
}

// leaseDuration claims to be "comfortably longer than the handler timeout so a
// slow-but-alive handler never has its row stolen by another loop". A lease at
// or below the timeout means a handler that runs to its full budget has its row
// re-claimed while it is still working — every side effect runs twice.
func TestLeaseOutlivesHandlerTimeoutSoARowIsNotStolen(t *testing.T) {
	for _, timeout := range []time.Duration{0, time.Second, 30 * time.Second, 10 * time.Minute} {
		w := newTestWorker(t, NewMemoryStore(), Config{HandlerTimeout: timeout},
			&countingHandler{name: "c", types: []string{TypeOrderPaidV1}})
		if got := w.leaseDuration(); got <= w.cfg.HandlerTimeout {
			t.Errorf("HandlerTimeout %s: lease = %s; a handler using its whole budget would have its row stolen",
				timeout, got)
		}
	}

	// And the consume loop must actually claim with it — a lease computed but
	// not passed is the same as no lease at all.
	spy := &leaseSpy{Store: NewMemoryStore()}
	w := newTestWorker(t, spy, Config{HandlerTimeout: 5 * time.Second},
		&countingHandler{name: "c", types: []string{TypeOrderPaidV1}})
	mustEnqueue(t, spy, TypeOrderPaidV1, "order:23", OrderPaidKey(23), OrderPaidData{OrderID: 23})
	ctx := context.Background()
	if _, err := w.FanOutOnce(ctx); err != nil {
		t.Fatalf("FanOutOnce: %v", err)
	}
	if _, err := w.ConsumeOnce(ctx); err != nil {
		t.Fatalf("ConsumeOnce: %v", err)
	}
	if spy.lease != w.leaseDuration() {
		t.Errorf("ConsumeOnce claimed with lease %s; want %s", spy.lease, w.leaseDuration())
	}
}

// PartitionKey "falls back to the subject, then to a constant so a message is
// never keyless". A keyless Kafka record is round-robined across partitions, so
// two facts about one order can be consumed out of order.
func TestPartitionKeyIsNeverEmpty(t *testing.T) {
	for _, tc := range []struct {
		name string
		env  *Envelope
		want string
	}{
		{"explicit partition key", &Envelope{Subject: "order:1", Rumera: Meta{PartitionKey: "pk"}}, "pk"},
		{"falls back to subject", &Envelope{Subject: "order:1"}, "order:1"},
		{"subjectless fact still keyed", &Envelope{}, "default"},
	} {
		if got := tc.env.PartitionKey(); got != tc.want {
			t.Errorf("%s: PartitionKey() = %q; want %q", tc.name, got, tc.want)
		}
	}

	// New() seeds the key from the subject, so a fact built the normal way is
	// keyed even before anything stamps it.
	env, err := New(TypeOrderPaidV1, "", OrderPaidKey(1), OrderPaidData{OrderID: 1})
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	if env.PartitionKey() == "" {
		t.Error("a fact built with no subject produced a keyless message")
	}
}
