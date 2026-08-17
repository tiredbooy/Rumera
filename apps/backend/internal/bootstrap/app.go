package bootstrap

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	config "github.com/tiredbooy/configs"
	"github.com/tiredbooy/internal/analytics"
	"github.com/tiredbooy/internal/corn"
	"github.com/tiredbooy/internal/logger"
	"github.com/tiredbooy/pkg/async"
	"github.com/tiredbooy/pkg/cache"
	"github.com/tiredbooy/pkg/database"
	"github.com/tiredbooy/pkg/meili"
	"github.com/tiredbooy/pkg/metrics"
	"github.com/tiredbooy/pkg/tracing"
	"go.uber.org/zap"
)

type App struct {
	cfg    *config.Config
	log    *zap.Logger
	dbs    *database.Connections
	cache  cache.Store
	queue  *analytics.Queue
	cron   *cron.Runner
	events *eventSubsystem
	router *gin.Engine
	server *http.Server
	// tracerShutdown flushes and stops the OpenTelemetry tracer provider. It is a
	// no-op when tracing is disabled, so it is always safe to call on teardown.
	tracerShutdown tracing.ShutdownFunc
}

// process is the per-process setup every entrypoint needs: config, logger,
// tracing, DB pools, cache, search and the fully wired dependency graph. New
// (the API) and NewEventWorker (cmd/event-worker) both start from here so
// neither duplicates build().
type process struct {
	cfg            *config.Config
	log            *zap.Logger
	dbs            *database.Connections
	cache          cache.Store
	container      *container
	tracerShutdown tracing.ShutdownFunc
}

func boot() (*process, error) {
	cfg, err := config.Load()
	if err != nil {
		return nil, fmt.Errorf("config: %w", err)
	}

	log, err := logger.New(cfg.Env, "logs")
	if err != nil {
		return nil, fmt.Errorf("logger: %w", err)
	}
	// Detached goroutines (OTP, order email, counters) recover panics via pkg/async.
	async.SetLogger(log)

	// Tracing must be initialised before the DB pools: the pgx instrumentation
	// captures the global tracer provider at construction, so the real provider
	// has to be installed first (no-op + cheap when OTEL_ENABLED=false).
	tracerShutdown, err := tracing.Init(context.Background(), cfg, log)
	if err != nil {
		return nil, fmt.Errorf("tracing: %w", err)
	}

	dbs, err := database.Connect(cfg, log)
	if err != nil {
		return nil, fmt.Errorf("database: %w", err)
	}

	// ── 4. Cache ─────────────────────────────────────────────────────────────
	// Redis is an optional dependency: if it is unreachable at boot we log and
	// continue with no cache rather than refusing to start. Every call site
	// already handles a nil store (read-through degrades to a direct DB read).
	var cacheStore cache.Store
	if store, cacheErr := cache.NewRedis(cfg, log); cacheErr != nil {
		log.Warn("cache unavailable at startup, continuing without it", zap.Error(cacheErr))
	} else {
		// Wrap the live store in a circuit breaker so a mid-life Redis outage
		// fails fast (reads degrade to a miss) instead of stalling every request
		// on per-call timeouts.
		cacheStore = cache.NewBreaker(store, cfg.CacheBreakerThreshold,
			cfg.CacheBreakerCooldown, log)
	}

	// ── 5. Meilisearch (PH-030b readiness; optional, not storefront path) ────
	// When MEILI_ENABLED=false (default), skip entirely. When true but Meili is
	// down, warn and continue — product discovery stays on Postgres ILIKE.
	var meiliClient *meili.Client
	if cfg.MeiliEnabled {
		client, meiliErr := meili.New(cfg.MeiliHost, cfg.MeiliAPIKey, cfg.MeiliIndexUID, log)
		if meiliErr != nil {
			log.Warn("meilisearch unavailable at startup; reindex job disabled",
				zap.Error(meiliErr), zap.String("host", cfg.MeiliHost))
		} else {
			meiliClient = client
		}
	}

	// ── 6. Dependency graph (repos → services → handlers) ────────────────────
	c := build(cfg, log, dbs, cacheStore, meiliClient)

	return &process{
		cfg:            cfg,
		log:            log,
		dbs:            dbs,
		cache:          cacheStore,
		container:      c,
		tracerShutdown: tracerShutdown,
	}, nil
}

func New() (*App, error) {
	p, err := boot()
	if err != nil {
		return nil, err
	}
	cfg, log, dbs, c := p.cfg, p.log, p.dbs, p.container

	// Expose live DB-pool and analytics-queue state to Prometheus. These are
	// scrape-time gauges, so they must be registered once the pools and queue
	// exist. The /metrics endpoint and request middleware are wired in newRouter.
	if cfg.MetricsEnabled {
		metrics.RegisterDBPool("main", dbs.DB)
		metrics.RegisterDBPool("analytics", dbs.AnalyticsDB)
		metrics.RegisterQueueDepth("events", c.queue.Depth, c.queue.Capacity())
	}

	// ── 7. Seed the first admin (no-op unless configured / already present) ───
	seedCtx, cancelSeed := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancelSeed()
	if err := seedAdmin(seedCtx, cfg, dbs, log); err != nil {
		return nil, fmt.Errorf("seed admin: %w", err)
	}

	router := newRouter(cfg, log, c)

	server := &http.Server{
		Addr:         fmt.Sprintf(":%s", cfg.ServerPort),
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
		// ReadHeaderTimeout caps how long a client may take to send request
		// headers, closing the Slowloris hold-the-connection attack that
		// ReadTimeout alone doesn't fully cover. MaxHeaderBytes bounds header
		// size to reject header-bomb requests cheaply.
		ReadHeaderTimeout: 5 * time.Second,
		MaxHeaderBytes:    1 << 20, // 1 MiB
	}

	return &App{
		cfg:            cfg,
		log:            log,
		dbs:            dbs,
		cache:          p.cache,
		queue:          c.queue,
		cron:           c.cron,
		events:         c.events,
		router:         router,
		server:         server,
		tracerShutdown: p.tracerShutdown,
	}, nil
}

func (a *App) Start(ctx context.Context) error {
	serverErr := make(chan error, 1)

	// Launch the analytics ingestion workers before accepting traffic so the
	// capture middleware always has somewhere to push events.
	a.queue.Start(ctx)

	// Start the background-job scheduler (analytics roll-ups, recommendation
	// profile refresh). nil when CRON_ENABLED=false.
	if a.cron != nil {
		a.cron.Start()
	}

	// Start the domain-event consumers. Not given ctx on purpose: the worker
	// must finish an in-flight side effect on SIGTERM rather than have it
	// cancelled mid-flight, so it stops through its own drain in shutdown.
	a.events.start()

	go func() {
		a.log.Info("server starting", zap.String("addr", a.server.Addr))
		if err := a.server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			serverErr <- err
		}
	}()

	select {
	case <-ctx.Done():
		a.log.Info("shutdown Signal Recived")
	case err := <-serverErr:
		return fmt.Errorf("server error: %w", err)
	}

	return a.shutdown()
}

func (a *App) shutdown() error {
	a.log.Info("shutting down gracefully…")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := a.server.Shutdown(shutdownCtx); err != nil {
		return fmt.Errorf("http shutdown: %w", err)
	}

	// Stop the scheduler and wait for any in-flight job to finish before the DB
	// pools it depends on are closed.
	if a.cron != nil {
		a.cron.Stop()
	}

	// Drain in-flight event handlers before the pools they write through close.
	// Must sit after cron.Stop and before dbs.Close.
	a.events.stop()

	// Drain buffered analytics events before tearing down the DB connections the
	// workers write through.
	a.queue.Shutdown()

	a.dbs.Close()
	if a.cache != nil {
		a.cache.Close()
	}

	// Flush any spans still buffered in the tracer's batch processor last, so it
	// captures traces from the shutdown path too. No-op when tracing is disabled.
	if a.tracerShutdown != nil {
		if err := a.tracerShutdown(shutdownCtx); err != nil {
			a.log.Warn("tracer shutdown", zap.Error(err))
		}
	}

	a.log.Info("shutdown complete")
	_ = a.log.Sync()
	return nil
}
