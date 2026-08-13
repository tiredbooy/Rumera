package bootstrap

import (
	"context"
	"crypto/subtle"
	"net/http"
	"strings"
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

	// Trust only the configured proxies for X-Forwarded-For, so c.ClientIP() (and
	// the per-IP rate limiters built on it) can't be spoofed by a forged header.
	// Empty config leaves Gin's default; set TRUSTED_PROXIES to your ingress range
	// in production. An invalid value fails loudly rather than silently mis-trusting.
	if len(cfg.TrustedProxies) > 0 {
		if err := r.SetTrustedProxies(cfg.TrustedProxies); err != nil {
			logger.Fatal("invalid TRUSTED_PROXIES", zap.Error(err))
		}
	}

	setupMiddlewares(r, cfg, logger)

	// Prometheus scrape target. Protected by bearer token when configured
	// (required in production — see Config.Validate).
	if cfg.MetricsEnabled {
		r.GET("/metrics", metricsAuth(cfg.MetricsBearerToken), gin.WrapH(metrics.Handler()))
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

	// Idempotency platform (PH-011): durable store on the main pool.
	// Webhook policy allows auto body-hash keys (gateways often omit headers).
	// Money policy is explicit-key only (optional until FE always sends keys);
	// no auto-key so two intentional places with the same body do not collapse.
	idemStore := middleware.NewIdempotencyStore(c.dbs.DB)
	webhookIdem := middleware.Idempotency(idemStore, logger)
	moneyIdem := middleware.IdempotencyWithConfig(idemStore, logger, middleware.IdempotencyConfig{
		AllowAutoKey: false,
		RequireKey:   false, // flip true after FE/BFF always send Idempotency-Key
	})
	routes.Setup(r, c.handler, c.jwt, c.cache, webhookIdem, moneyIdem)

	return r
}

// metricsAuth requires Authorization: Bearer <token> when token is non-empty.
// An empty token leaves the endpoint open (development only; production
// Validate refuses this combination).
func metricsAuth(token string) gin.HandlerFunc {
	expected := strings.TrimSpace(token)
	return func(c *gin.Context) {
		if expected == "" {
			c.Next()
			return
		}
		h := c.GetHeader("Authorization")
		const prefix = "Bearer "
		if len(h) <= len(prefix) || !strings.EqualFold(h[:len(prefix)], prefix) {
			c.AbortWithStatus(http.StatusUnauthorized)
			return
		}
		provided := strings.TrimSpace(h[len(prefix):])
		if subtle.ConstantTimeCompare([]byte(provided), []byte(expected)) != 1 {
			c.AbortWithStatus(http.StatusUnauthorized)
			return
		}
		c.Next()
	}
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
