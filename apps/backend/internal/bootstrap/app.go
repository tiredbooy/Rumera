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
	"github.com/tiredbooy/internal/logger"
	"github.com/tiredbooy/pkg/cache"
	"github.com/tiredbooy/pkg/database"
	"go.uber.org/zap"
)

type App struct {
	cfg    *config.Config
	log    *zap.Logger
	dbs    *database.Connections
	cache  cache.Store
	queue  *analytics.Queue
	router *gin.Engine
	server *http.Server
}

func New() (*App, error) {
	cfg, err := config.Load()
	if err != nil {
		return nil, fmt.Errorf("config: %w", err)
	}

	log, err := logger.New(cfg.Env, "logs")
	if err != nil {
		return nil, fmt.Errorf("logger: %w", err)
	}

	dbs, err := database.Connect(cfg, log)
	if err != nil {
		return nil, fmt.Errorf("database: %w", err)
	}

	// ── 4. Cache (add when pkg/cache is ready) ───────────────────────────────
	cacheStore, err := cache.NewRedis(cfg, log)
	if err != nil {
		return nil, fmt.Errorf("Cache: %w", err)
	}

	// ── 5. Search (add when pkg/search is ready) ─────────────────────────────
	// meili, err := search.NewMeilisearch(cfg, log)

	// ── 6. Dependency graph (repos → services → handlers) ────────────────────
	c := build(cfg, log, dbs, cacheStore)

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
	}

	return &App{
		cfg:    cfg,
		log:    log,
		dbs:    dbs,
		cache:  cacheStore,
		queue:  c.queue,
		router: router,
		server: server,
	}, nil
}

func (a *App) Start(ctx context.Context) error {
	serverErr := make(chan error, 1)

	// Launch the analytics ingestion workers before accepting traffic so the
	// capture middleware always has somewhere to push events.
	a.queue.Start(ctx)

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

	// Drain buffered analytics events before tearing down the DB connections the
	// workers write through.
	a.queue.Shutdown()

	a.dbs.Close()
	a.cache.Close()

	a.log.Info("shutdown complete")
	_ = a.log.Sync()
	return nil
}
