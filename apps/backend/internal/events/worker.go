package events

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"math/rand"
	"sync"
	"time"

	"go.uber.org/zap"
)

// Bus transports.
const (
	BusPostgres = "postgres"
	BusKafka    = "kafka"
)

// Publisher sends a serialized envelope to a topic. Implemented by the Kafka
// adapter; nil when EVENTS_BUS=postgres.
type Publisher interface {
	Publish(ctx context.Context, topic, key string, value []byte) error
}

// Observer receives worker outcomes so metrics stay out of the core loop.
// Every method must tolerate being called concurrently.
type Observer interface {
	Consumed(consumer, eventType, result string, d time.Duration)
	Retried(consumer, eventType string)
	DeadLettered(consumer, eventType string)
	Published(eventType, result string)
	Lag(d time.Duration)
	// RelayLag is the age of the oldest unpublished fact. Lag is derived from
	// consumption rows, which in Kafka mode only exist once the broker delivers
	// a fact back — so Lag reads 0 during a total ingest failure. This is the
	// gauge that moves when the broker is unreachable (K-3).
	RelayLag(d time.Duration)
	Depth(status string, n int64)
}

// Config tunes the worker loops. Zero values fall back to sane defaults, so a
// partially populated Config is safe.
type Config struct {
	Bus             string
	FanOutInterval  time.Duration
	FanOutBatch     int
	ConsumeInterval time.Duration
	ConsumeBatch    int
	RelayInterval   time.Duration
	RelayBatch      int
	MaxAttempts     int
	BackoffBase     time.Duration
	BackoffMax      time.Duration
	HandlerTimeout  time.Duration
	MetricsInterval time.Duration
	Concurrency     int
	// FallbackAfter is how long a fact may sit undelivered by Kafka before the
	// Postgres fan-out picks it up anyway (K-4). Only consulted when Bus is
	// kafka; the Postgres path fans out immediately.
	FallbackAfter time.Duration
}

// fanOutMinAge is the age gate the fan-out loop claims with: zero in Postgres
// mode (this is the primary path, fan out now), FallbackAfter in Kafka mode
// (this is the safety net, let the broker have its window first).
func (c Config) fanOutMinAge() time.Duration {
	if c.Bus == BusKafka {
		return c.FallbackAfter
	}
	return 0
}

func (c Config) withDefaults() Config {
	if c.Bus == "" {
		c.Bus = BusPostgres
	}
	if c.FanOutInterval <= 0 {
		c.FanOutInterval = time.Second
	}
	if c.FanOutBatch <= 0 {
		c.FanOutBatch = 100
	}
	if c.ConsumeInterval <= 0 {
		c.ConsumeInterval = time.Second
	}
	if c.ConsumeBatch <= 0 {
		c.ConsumeBatch = 50
	}
	if c.RelayInterval <= 0 {
		c.RelayInterval = time.Second
	}
	if c.RelayBatch <= 0 {
		c.RelayBatch = 100
	}
	if c.MaxAttempts <= 0 {
		c.MaxAttempts = 8
	}
	if c.BackoffBase <= 0 {
		c.BackoffBase = 2 * time.Second
	}
	if c.BackoffMax <= 0 {
		c.BackoffMax = time.Hour
	}
	if c.HandlerTimeout <= 0 {
		c.HandlerTimeout = 30 * time.Second
	}
	if c.MetricsInterval <= 0 {
		c.MetricsInterval = 15 * time.Second
	}
	if c.Concurrency <= 0 {
		c.Concurrency = 4
	}
	if c.FallbackAfter <= 0 {
		// Long enough that a healthy broker plus a redelivery or two always wins
		// the race and the fallback stays idle; short enough that a broker outage
		// costs minutes of delayed side effects, not the hour BackoffMax allows.
		c.FallbackAfter = 5 * time.Minute
	}
	return c
}

// Worker drains the outbox: it fans facts out to consumers, runs them with a
// retry budget, dead-letters what cannot succeed, and (in Kafka mode) relays
// facts to the broker.
//
// It is deliberately crash-safe rather than clever: every state transition is a
// single UPDATE, and nothing is marked done before its handler returns nil.
type Worker struct {
	store    Store
	registry *Registry
	log      *zap.Logger
	pub      Publisher
	obs      Observer
	cfg      Config

	wg   sync.WaitGroup
	stop chan struct{}
	once sync.Once
}

// NewWorker builds a worker. publisher may be nil when the bus is Postgres.
func NewWorker(store Store, registry *Registry, log *zap.Logger, pub Publisher, obs Observer, cfg Config) *Worker {
	return &Worker{
		store:    store,
		registry: registry,
		log:      log,
		pub:      pub,
		obs:      obs,
		cfg:      cfg.withDefaults(),
		stop:     make(chan struct{}),
	}
}

// Start launches the loops in the background.
//
// ctx must NOT be the server's signal context: on SIGTERM that would cancel an
// in-flight handler mid side effect. Pass context.Background() and stop the
// worker through Shutdown, which drains first.
func (w *Worker) Start(ctx context.Context) {
	if w.registry == nil || w.registry.Len() == 0 {
		if w.log != nil {
			w.log.Info("events worker: no consumers registered, not starting")
		}
		return
	}
	if w.cfg.Bus == BusKafka && w.pub != nil {
		w.spawn(func() { w.relayLoop(ctx) })
	}
	// Postgres bus fans out locally and immediately. Kafka mode runs the same loop
	// as a staleness-gated fallback (K-4): the consumer side normally fans out as
	// messages arrive and sets dispatched_at, so this claims nothing while the
	// broker is healthy — but a broker outage no longer stops every order.paid
	// side effect, it only delays it by FallbackAfter. This is the condition the
	// single-broker/RF=1 decision rests on.
	w.spawn(func() { w.fanOutLoop(ctx) })
	for i := 0; i < w.cfg.Concurrency; i++ {
		w.spawn(func() { w.consumeLoop(ctx) })
	}
	w.spawn(func() { w.metricsLoop(ctx) })

	if w.log != nil {
		w.log.Info("events worker started",
			zap.String("bus", w.cfg.Bus),
			zap.Int("consumers", w.registry.Len()),
			zap.Int("concurrency", w.cfg.Concurrency),
		)
	}
}

func (w *Worker) spawn(fn func()) {
	w.wg.Add(1)
	go func() {
		defer w.wg.Done()
		fn()
	}()
}

// Shutdown stops the loops and waits for in-flight handlers to finish.
func (w *Worker) Shutdown() {
	w.once.Do(func() { close(w.stop) })
	w.wg.Wait()
}

// sleep waits for d, or returns false if the worker is stopping.
func (w *Worker) sleep(ctx context.Context, d time.Duration) bool {
	t := time.NewTimer(d)
	defer t.Stop()
	select {
	case <-t.C:
		return true
	case <-w.stop:
		return false
	case <-ctx.Done():
		return false
	}
}

// ── relay: outbox → Kafka ────────────────────────────────────────────────────

func (w *Worker) relayLoop(ctx context.Context) {
	for {
		n, err := w.RelayOnce(ctx)
		if err != nil && w.log != nil {
			w.log.Warn("events relay", zap.Error(err))
		}
		// Drain a full batch back-to-back; only idle when there is nothing left.
		// The stop check is what bounds Shutdown — without it a sustained
		// backlog keeps this branch looping and never reaches w.sleep, the only
		// other place w.stop is observed.
		if n >= w.cfg.RelayBatch && !w.stopping() {
			continue
		}
		if !w.sleep(ctx, w.cfg.RelayInterval) {
			return
		}
	}
}

// RelayOnce publishes one batch. Exported so a test can drive the loop
// deterministically.
func (w *Worker) RelayOnce(ctx context.Context) (int, error) {
	rows, err := w.store.ClaimUnpublished(ctx, w.cfg.RelayBatch)
	if err != nil {
		return 0, err
	}
	published := 0
	for _, row := range rows {
		payload, err := json.Marshal(row.Envelope)
		if err != nil {
			// Unserializable row would block the relay forever; park it far out
			// and let an operator look.
			_ = w.store.MarkPublishError(ctx, row.PK, "marshal: "+err.Error(), time.Now().Add(w.cfg.BackoffMax))
			w.observePublished(row.Envelope.Type, "error")
			continue
		}
		topic := TopicFor(row.Envelope.Type)
		if err := w.pub.Publish(ctx, topic, row.Envelope.PartitionKey(), payload); err != nil {
			backoff := Backoff(row.PublishAttempts, w.cfg.BackoffBase, w.cfg.BackoffMax)
			_ = w.store.MarkPublishError(ctx, row.PK, err.Error(), time.Now().Add(backoff))
			w.observePublished(row.Envelope.Type, "error")
			if w.log != nil {
				w.log.Warn("events publish failed",
					zap.String("type", row.Envelope.Type),
					zap.String("topic", topic),
					zap.Int("attempts", row.PublishAttempts),
					zap.Duration("retry_in", backoff),
					zap.Error(err),
				)
			}
			continue
		}
		if err := w.store.MarkPublished(ctx, row.PK); err != nil {
			return published, err
		}
		w.observePublished(row.Envelope.Type, "ok")
		published++
	}
	return published, nil
}

// ── fan-out: facts → per-consumer ledger rows ────────────────────────────────

func (w *Worker) fanOutLoop(ctx context.Context) {
	bindings := w.registry.Bindings()
	minAge := w.cfg.fanOutMinAge()
	for {
		n, err := w.store.FanOut(ctx, bindings, w.cfg.FanOutBatch, minAge)
		if err != nil && w.log != nil {
			w.log.Warn("events fan-out", zap.Error(err))
		}
		// In Kafka mode anything claimed here is a fact the broker failed to
		// deliver for FallbackAfter. That is a broker incident, not routine.
		if n > 0 && minAge > 0 && w.log != nil {
			w.log.Warn("events fan-out fallback engaged: kafka did not deliver in time",
				zap.Int("facts", n),
				zap.Duration("older_than", minAge),
			)
		}
		if n >= w.cfg.FanOutBatch && !w.stopping() {
			continue
		}
		if !w.sleep(ctx, w.cfg.FanOutInterval) {
			return
		}
	}
}

// FanOutOnce runs a single fan-out pass. Exported for tests.
func (w *Worker) FanOutOnce(ctx context.Context) (int, error) {
	return w.store.FanOut(ctx, w.registry.Bindings(), w.cfg.FanOutBatch, w.cfg.fanOutMinAge())
}

// Ingest records a fact that arrived off the wire so the consume loop picks it
// up. Idempotent — a Kafka redelivery costs one no-op insert.
func (w *Worker) Ingest(ctx context.Context, env *Envelope) error {
	return w.store.FanOutEnvelope(ctx, env, w.registry.Bindings())
}

// ── consume: run handlers with a retry budget ────────────────────────────────

func (w *Worker) consumeLoop(ctx context.Context) {
	for {
		n, err := w.ConsumeOnce(ctx)
		if err != nil && w.log != nil {
			w.log.Warn("events consume", zap.Error(err))
		}
		if n >= w.cfg.ConsumeBatch && !w.stopping() {
			continue
		}
		if !w.sleep(ctx, w.cfg.ConsumeInterval) {
			return
		}
	}
}

// ConsumeOnce claims and runs one batch. Exported so tests can drive the loop
// without sleeping.
//
// The claim takes a lease longer than the handler timeout, so a row being
// worked on is invisible to the other consume loops and to other replicas. A
// crashed worker's rows simply become runnable again when their lease expires.
func (w *Worker) ConsumeOnce(ctx context.Context) (int, error) {
	due, err := w.store.ClaimDue(ctx, w.cfg.ConsumeBatch, w.leaseDuration())
	if err != nil {
		return 0, err
	}
	for _, d := range due {
		// Stop between rows, not just between batches: a full batch of slow
		// handlers would otherwise hold Shutdown for batch × timeout. The rows
		// left unrun keep their lease and are picked up after it expires.
		if w.stopping() {
			break
		}
		w.run(ctx, d)
	}
	return len(due), nil
}

// leaseDuration is the visibility timeout applied when claiming a consumption.
// Comfortably longer than the handler timeout so a slow-but-alive handler never
// has its row stolen by another loop.
func (w *Worker) leaseDuration() time.Duration {
	return w.cfg.HandlerTimeout + 30*time.Second
}

// stopping reports whether Shutdown has been called.
func (w *Worker) stopping() bool {
	select {
	case <-w.stop:
		return true
	default:
		return false
	}
}

func (w *Worker) run(ctx context.Context, d Due) {
	handler, ok := w.registry.Get(d.Consumer)
	if !ok {
		// A consumer was removed while rows were still queued. Park rather than
		// spin — an operator either restores it or replays elsewhere.
		_ = w.store.MarkDLQ(ctx, d.Envelope.ID, d.Consumer, "no handler registered")
		w.observeDeadLettered(d.Consumer, d.Envelope.Type)
		return
	}

	// Detach from the caller so a shutdown mid-handler cannot abort a side
	// effect halfway; the timeout is the real bound.
	runCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), w.cfg.HandlerTimeout)
	defer cancel()

	start := time.Now()
	err := safeHandle(runCtx, handler, d.Envelope)
	elapsed := time.Since(start)

	if err == nil {
		if derr := w.store.MarkDone(ctx, d.Envelope.ID, d.Consumer); derr != nil && w.log != nil {
			w.log.Error("events mark done failed", zap.String("consumer", d.Consumer), zap.Error(derr))
		}
		w.observeConsumed(d.Consumer, d.Envelope.Type, "ok", elapsed)
		return
	}

	permanent := IsPermanent(err)
	exhausted := d.Attempts >= w.cfg.MaxAttempts
	if permanent || exhausted {
		reason := err.Error()
		if exhausted && !permanent {
			reason = fmt.Sprintf("max attempts (%d) exhausted: %s", w.cfg.MaxAttempts, reason)
		}
		_ = w.store.MarkDLQ(ctx, d.Envelope.ID, d.Consumer, reason)
		w.observeConsumed(d.Consumer, d.Envelope.Type, "dlq", elapsed)
		w.observeDeadLettered(d.Consumer, d.Envelope.Type)
		if w.log != nil {
			w.log.Error("events consumer dead-lettered",
				zap.String("consumer", d.Consumer),
				zap.String("type", d.Envelope.Type),
				zap.String("event_id", d.Envelope.ID),
				zap.String("idempotency_key", d.Envelope.Rumera.IdempotencyKey),
				zap.Int("attempts", d.Attempts),
				zap.Bool("permanent", permanent),
				zap.Error(err),
			)
		}
		return
	}

	backoff := Backoff(d.Attempts, w.cfg.BackoffBase, w.cfg.BackoffMax)
	_ = w.store.MarkRetry(ctx, d.Envelope.ID, d.Consumer, err.Error(), time.Now().Add(backoff))
	w.observeConsumed(d.Consumer, d.Envelope.Type, "retry", elapsed)
	w.observeRetried(d.Consumer, d.Envelope.Type)
	if w.log != nil {
		w.log.Warn("events consumer failed, will retry",
			zap.String("consumer", d.Consumer),
			zap.String("type", d.Envelope.Type),
			zap.String("event_id", d.Envelope.ID),
			zap.Int("attempts", d.Attempts),
			zap.Duration("retry_in", backoff),
			zap.Error(err),
		)
	}
}

// safeHandle turns a panicking handler into a permanent failure instead of
// taking the process down with it.
func safeHandle(ctx context.Context, h Handler, env *Envelope) (err error) {
	defer func() {
		if r := recover(); r != nil {
			err = Permanent(fmt.Errorf("handler panic: %v", r))
		}
	}()
	return h.Handle(ctx, env)
}

// ── metrics ──────────────────────────────────────────────────────────────────

func (w *Worker) metricsLoop(ctx context.Context) {
	for {
		if !w.sleep(ctx, w.cfg.MetricsInterval) {
			return
		}
		w.SampleMetrics(ctx)
	}
}

// SampleMetrics publishes one round of gauges. Exported so a test can assert
// what is sampled without driving the loop.
func (w *Worker) SampleMetrics(ctx context.Context) {
	if w.obs == nil {
		return
	}
	if lag, err := w.store.OldestPendingAge(ctx); err == nil {
		w.obs.Lag(lag)
	}
	// Only meaningful in Kafka mode: nothing sets published_at on the Postgres
	// path (see K-10), so sampling there would report the age of the oldest fact
	// ever written and page on a perfectly healthy system.
	if w.cfg.Bus == BusKafka {
		if lag, err := w.store.OldestUnpublishedAge(ctx); err == nil {
			w.obs.RelayLag(lag)
		}
	}
	if counts, err := w.store.CountByStatus(ctx); err == nil {
		for _, s := range []string{StatusPending, StatusRetry, StatusDone, StatusDLQ} {
			w.obs.Depth(s, counts[s])
		}
	}
}

func (w *Worker) observeConsumed(consumer, eventType, result string, d time.Duration) {
	if w.obs != nil {
		w.obs.Consumed(consumer, eventType, result, d)
	}
}

func (w *Worker) observeRetried(consumer, eventType string) {
	if w.obs != nil {
		w.obs.Retried(consumer, eventType)
	}
}

func (w *Worker) observeDeadLettered(consumer, eventType string) {
	if w.obs != nil {
		w.obs.DeadLettered(consumer, eventType)
	}
}

func (w *Worker) observePublished(eventType, result string) {
	if w.obs != nil {
		w.obs.Published(eventType, result)
	}
}

// ── backoff ──────────────────────────────────────────────────────────────────

// Backoff returns base * 2^(attempt-1), capped at max, with up to 20% jitter.
//
// Jitter matters when a shared dependency (SMTP, the gateway) comes back: without
// it every parked row retries in the same instant and knocks it straight over.
func Backoff(attempt int, base, max time.Duration) time.Duration {
	if attempt < 1 {
		attempt = 1
	}
	if base <= 0 {
		base = time.Second
	}
	if max <= 0 {
		max = time.Hour
	}
	// Cap the exponent before shifting so a large attempt count cannot overflow.
	exp := attempt - 1
	if exp > 32 {
		exp = 32
	}
	d := time.Duration(float64(base) * math.Pow(2, float64(exp)))
	if d <= 0 || d > max {
		d = max
	}
	jitter := time.Duration(rand.Int63n(int64(d)/5 + 1))
	return d + jitter
}

// ErrNoPublisher is returned when Kafka mode is selected without a publisher.
var ErrNoPublisher = errors.New("events: bus is kafka but no publisher was configured")
