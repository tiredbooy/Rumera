package bootstrap

import (
	"context"
	"errors"
	"sync"
	"sync/atomic"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	config "github.com/tiredbooy/configs"
	"github.com/tiredbooy/internal/eventconsumers"
	"github.com/tiredbooy/internal/events"
	eventspg "github.com/tiredbooy/internal/events/postgres"
	notifkafka "github.com/tiredbooy/internal/notifications/kafka"
	"github.com/tiredbooy/pkg/metrics"
	"go.uber.org/zap"
)

// eventSubsystem is everything the domain-fact bus needs at runtime. It is
// assembled in two steps because the emitter must exist before the services
// that produce facts, while the consumers can only be registered after those
// same services exist.
type eventSubsystem struct {
	store    events.Store
	emitter  *events.Emitter
	registry *events.Registry
	worker   *events.Worker
	// consumer is the Kafka reader; nil on the Postgres bus.
	consumer *notifkafka.Consumer
	// publisher is the Kafka writer; nil on the Postgres bus.
	publisher *notifkafka.Publisher
	// ingestCancel + ingestWG let stop() wait for the Kafka ingest goroutine.
	ingestCancel context.CancelFunc
	ingestWG     sync.WaitGroup
	// ingestUp mirrors the consumer's running state for the readiness probe.
	ingestUp atomic.Bool
	// runIngest defaults to consumer.Run; a test swaps it to drive the supervisor
	// without a broker. ingestBackoffBase likewise defaults when zero.
	runIngest         func(context.Context) error
	ingestBackoffBase time.Duration
	log          *zap.Logger
	cfg          *config.Config
}

// newEventSubsystem builds the store, emitter and (empty) registry. Called
// early in build() so the emitter can be injected into payments and orders.
func newEventSubsystem(cfg *config.Config, log *zap.Logger, db *pgxpool.Pool) *eventSubsystem {
	store := eventspg.NewStore(db)
	return &eventSubsystem{
		store:    store,
		emitter:  events.NewEmitter(store, cfg.EventsEnabled),
		registry: events.NewRegistry(),
		log:      log,
		cfg:      cfg,
	}
}

// registerConsumers wires the order.paid handlers. Nil collaborators are
// skipped rather than registered as typed nils, which would panic on the first
// method call.
func (e *eventSubsystem) registerConsumers(deps eventconsumers.OrderPaidDeps) {
	if e == nil || !e.cfg.EventsEnabled {
		return
	}
	for _, h := range eventconsumers.OrderPaidHandlers(deps) {
		e.registry.Register(h)
	}
	e.log.Info("event consumers registered", zap.Int("count", e.registry.Len()))
}

// buildWorker constructs the worker once consumers are registered. Returns nil
// when this process is not meant to run them.
//
// standalone is the cmd/event-worker opt-in. That process runs with
// EVENTS_WORKER=external, so EventsWorkerEmbedded() is false and it would get a
// nil worker back: a worker process that boots, looks healthy and consumes
// nothing — the exact failure K-5 was about. It therefore claims the worker
// explicitly rather than inheriting it from the env var.
func (e *eventSubsystem) buildWorker(standalone bool) *events.Worker {
	if e == nil || !(standalone || e.cfg.EventsWorkerEmbedded()) || e.registry.Len() == 0 {
		return nil
	}
	var pub events.Publisher
	var auth notifkafka.Auth
	if e.cfg.EventsBus == events.BusKafka {
		mech, err := e.cfg.KafkaSASL()
		if err != nil {
			// Unreachable in practice: Config.Validate builds the same mechanism
			// at boot. Reaching it would mean dialing the broker unauthenticated,
			// so die rather than degrade.
			e.log.Fatal("kafka SASL configuration is invalid", zap.Error(err))
		}
		auth = notifkafka.Auth{SASL: mech, TLS: e.cfg.KafkaTLSEnabled}
		e.publisher = notifkafka.NewPublisher(e.cfg.KafkaBrokerList(), auth)
		pub = e.publisher
	}
	e.worker = events.NewWorker(e.store, e.registry, e.log, pub, events.MetricsObserver{}, events.Config{
		Bus:             e.cfg.EventsBus,
		FanOutInterval:  e.cfg.EventsFanOutInterval,
		FanOutBatch:     e.cfg.EventsFanOutBatch,
		ConsumeInterval: e.cfg.EventsConsumeInterval,
		ConsumeBatch:    e.cfg.EventsConsumeBatch,
		RelayInterval:   e.cfg.EventsRelayInterval,
		RelayBatch:      e.cfg.EventsRelayBatch,
		MaxAttempts:     e.cfg.EventsMaxAttempts,
		BackoffBase:     e.cfg.EventsBackoffBase,
		BackoffMax:      e.cfg.EventsBackoffMax,
		HandlerTimeout:  e.cfg.EventsHandlerTimeout,
		MetricsInterval: e.cfg.EventsMetricsInterval,
		Concurrency:     e.cfg.EventsConcurrency,
		FallbackAfter:   e.cfg.EventsFallbackAfter,
	})
	if e.cfg.EventsBus == events.BusKafka {
		e.consumer = notifkafka.NewConsumer(
			e.cfg.KafkaBrokerList(),
			e.cfg.EventsConsumerGroup,
			events.Topics(),
			auth,
		)
		e.consumer.Handler = &events.KafkaIngestHandler{Worker: e.worker}
		e.consumer.Log = e.log
		e.consumer.MaxAttempts = e.cfg.EventsMaxAttempts
		e.consumer.DLQ = e.publisher
	}
	return e.worker
}

// start launches the worker loops.
//
// Deliberately NOT given the server's signal context: on SIGTERM that would
// cancel a handler mid side effect. The loops stop through stop(), which drains
// first. (The analytics queue has the opposite wiring and loses its buffer on
// shutdown — do not copy that pattern here.)
func (e *eventSubsystem) start() {
	if e == nil || e.worker == nil {
		return
	}
	e.worker.Start(context.Background())
	if e.consumer != nil {
		ctx, cancel := context.WithCancel(context.Background())
		e.ingestCancel = cancel
		e.ingestWG.Add(1)
		go func() {
			defer e.ingestWG.Done()
			e.superviseIngest(ctx)
		}()
	}
}

// ingestRestartBackoff caps how fast a crash-looping consumer retries. Low
// enough that a transient broker blip costs seconds of lag, high enough that an
// unreachable broker does not spin.
const (
	ingestRestartBackoffBase = 2 * time.Second
	ingestRestartBackoffMax  = time.Minute
)

// superviseIngest keeps the Kafka ingest consumer running for the life of the
// process.
//
// Before K-5 a fatal reader error returned out of Run, got logged once, and the
// goroutine exited — ingest was dead until someone redeployed, with no metric, no
// health signal and a green healthcheck. Consumption is at-least-once and offsets
// are only committed after a message settles, so restarting is safe: Kafka
// redelivers from the last committed offset.
func (e *eventSubsystem) superviseIngest(ctx context.Context) {
	run := e.runIngest
	if run == nil {
		run = e.consumer.Run
	}
	backoff := e.ingestBackoffBase
	if backoff <= 0 {
		backoff = ingestRestartBackoffBase
	}
	for {
		e.ingestUp.Store(true)
		metrics.SetEventIngestUp(true)

		err := run(ctx)

		e.ingestUp.Store(false)
		metrics.SetEventIngestUp(false)

		if ctx.Err() != nil {
			// Ordinary shutdown.
			return
		}
		if err == nil {
			// Every reader returned cleanly without a shutdown being requested.
			// Ingest is still stopped, so this is a restart case too.
			err = errors.New("all readers returned without a shutdown")
		}
		metrics.IncEventIngestRestart()
		e.log.Error("event kafka ingest stopped, restarting",
			zap.Duration("in", backoff),
			zap.Error(err),
		)

		select {
		case <-ctx.Done():
			return
		case <-time.After(backoff):
		}
		if backoff *= 2; backoff > ingestRestartBackoffMax {
			backoff = ingestRestartBackoffMax
		}
	}
}

// ingestStatus reports the Kafka ingest state for the readiness probe.
func (e *eventSubsystem) ingestStatus() string {
	if e == nil || e.consumer == nil {
		return "disabled"
	}
	if e.ingestUp.Load() {
		return "up"
	}
	return "down"
}

// stop drains in-flight handlers and closes the Kafka clients.
func (e *eventSubsystem) stop() {
	if e == nil || e.worker == nil {
		return
	}
	if e.consumer != nil {
		if e.ingestCancel != nil {
			e.ingestCancel()
		}
		_ = e.consumer.Close()
		e.ingestWG.Wait()
	}
	e.worker.Shutdown()
	if e.publisher != nil {
		_ = e.publisher.Close()
	}
}

// EventWorker is the standalone domain-event consumer process: the same
// subsystem the API embeds, wired from the same build(), minus the HTTP server,
// the cron scheduler, the analytics workers and admin seeding.
type EventWorker struct{ p *process }

// NewEventWorker boots the shared dependency graph and claims the event worker
// for this process.
func NewEventWorker() (*EventWorker, error) {
	p, err := boot()
	if err != nil {
		return nil, err
	}
	// Idling would be worse than not starting: the deploy looks alive while no
	// facts are consumed and the producers still emit them.
	if !p.cfg.EventsEnabled {
		return nil, errors.New("EVENTS_ENABLED=false: producers run the legacy in-request side effects, " +
			"so this worker has nothing to consume — do not deploy it in that mode")
	}
	// build() already called buildWorker(false) and got nil: this process runs
	// with EVENTS_WORKER=external. Opt in explicitly — see buildWorker.
	if p.container.events.buildWorker(true) == nil {
		return nil, errors.New("no event consumers registered — nothing to run")
	}
	return &EventWorker{p: p}, nil
}

// Run starts the loops and blocks until ctx is cancelled, then drains.
func (w *EventWorker) Run(ctx context.Context) error {
	e := w.p.container.events
	w.p.log.Info("event worker starting",
		zap.String("bus", w.p.cfg.EventsBus),
		zap.Int("consumers", e.registry.Len()),
		zap.Int("concurrency", w.p.cfg.EventsConcurrency),
	)
	// start() deliberately takes no context: a SIGTERM must not cancel a handler
	// mid side effect. Shutdown goes through stop(), which drains first.
	e.start()

	<-ctx.Done()
	w.p.log.Info("event worker draining")
	e.stop()

	w.p.dbs.Close()
	if w.p.cache != nil {
		w.p.cache.Close()
	}
	if w.p.tracerShutdown != nil {
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := w.p.tracerShutdown(shutdownCtx); err != nil {
			w.p.log.Warn("tracer shutdown", zap.Error(err))
		}
	}
	w.p.log.Info("event worker stopped")
	_ = w.p.log.Sync()
	return nil
}

// prune deletes settled facts past the retention horizon. Registered as a cron
// job — nothing pruned the bus before, so both tables grew without bound.
//
// Matches the cron runner's job signature (no error return): a failed sweep is
// logged and retried on the next tick, it is not worth failing anything over.
func (e *eventSubsystem) prune(ctx context.Context) {
	if e == nil || e.store == nil {
		return
	}
	cutoff := time.Now().Add(-e.cfg.EventsRetention)
	n, err := e.store.Prune(ctx, cutoff, 5000)
	if err != nil {
		e.log.Warn("prune domain events", zap.Error(err))
		return
	}
	if n > 0 {
		e.log.Info("pruned domain events", zap.Int64("rows", n))
	}
}
