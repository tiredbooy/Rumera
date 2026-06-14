package bootstrap

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	config "github.com/tiredbooy/configs"
	"github.com/tiredbooy/internal/middlewares"
	"github.com/tiredbooy/internal/routes"
	"github.com/tiredbooy/pkg/metrics"
	"github.com/tiredbooy/pkg/middleware"
	"go.uber.org/zap"
)

func newRouter(cfg *config.Config, logger *zap.Logger, c *container) *gin.Engine {
	if !cfg.IsDevelopment() {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.New()
	setupMiddlewares(r, cfg, logger)

	// Prometheus scrape target. Internal-only — keep it off the public ingress.
	if cfg.MetricsEnabled {
		r.GET("/metrics", gin.WrapH(metrics.Handler()))
	}

	// Readiness probe: verifies the process can actually serve traffic by pinging
	// its hard dependencies (databases + cache). Distinct from the liveness
	// `/health` check, which only proves the process is up.
	registerReadiness(r, c)

	// Analytics capture runs globally and fires after the handler returns, so it
	// observes the identity that the per-group Auth middleware sets during
	// c.Next(). It never blocks the request — events are pushed to a buffered
	// queue and dropped under back-pressure.
	r.Use(middlewares.Analytics(c.queue))

	// Idempotency guard for at-least-once callers (payment webhook): backed by a
	// durable table on the main pool so replays are deduplicated across restarts.
	idempotency := middleware.Idempotency(middleware.NewIdempotencyStore(c.dbs.DB), logger)
	routes.Setup(r, c.handler, c.jwt, c.cache, idempotency)

	return r
}

// registerReadiness wires GET /health/ready. It returns 200 only when every
// backing dependency responds within a short timeout, otherwise 503 with a
// per-dependency status map — the shape orchestrators (k8s, load balancers)
// expect for readiness gating.
func registerReadiness(r *gin.Engine, c *container) {
	r.GET("/health/ready", func(ctx *gin.Context) {
		checkCtx, cancel := context.WithTimeout(ctx.Request.Context(), 2*time.Second)
		defer cancel()

		deps := gin.H{}
		ready := true

		if err := c.dbs.DB.Ping(checkCtx); err != nil {
			deps["main_db"] = "down"
			ready = false
		} else {
			deps["main_db"] = "up"
		}
		if err := c.dbs.AnalyticsDB.Ping(checkCtx); err != nil {
			deps["analytics_db"] = "down"
			ready = false
		} else {
			deps["analytics_db"] = "up"
		}
		// Cache is an optional dependency: report its health but never gate
		// readiness on it — the app serves from the database when Redis is down
		// (or its breaker is open), so a degraded cache must not fail the probe.
		switch {
		case c.cache == nil:
			deps["cache"] = "disabled"
		case c.cache.Ping(checkCtx) != nil:
			deps["cache"] = "degraded"
		default:
			deps["cache"] = "up"
		}

		status := http.StatusOK
		if !ready {
			status = http.StatusServiceUnavailable
		}
		ctx.JSON(status, gin.H{"ready": ready, "dependencies": deps})
	})
}
