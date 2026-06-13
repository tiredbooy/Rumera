package bootstrap

import (
	"time"

	"github.com/gin-contrib/gzip"
	"github.com/gin-gonic/gin"
	config "github.com/tiredbooy/configs"
	"github.com/tiredbooy/internal/middlewares"
	"github.com/tiredbooy/pkg/middleware"
	"go.uber.org/zap"
	"golang.org/x/time/rate"
)

func setupMiddlewares(r *gin.Engine, cfg *config.Config, log *zap.Logger) {

	r.Use(middleware.Recovery(log))
	r.Use(middleware.RequestID())
	// Security headers + CORS run early so they apply even to aborted requests.
	r.Use(middlewares.SecurityHeaders())
	r.Use(middlewares.CORS(cfg.CORSAllowedOrigins))
	r.Use(middleware.Logger(log))
	// Metrics capture runs right after logging so it times the full handler chain
	// (including rate-limit rejections and gzip), labelled by matched route.
	if cfg.MetricsEnabled {
		r.Use(middleware.Metrics())
	}
	r.Use(middleware.Timeout(30 * time.Second))
	r.Use(middleware.RateLimit(rate.Limit(100), 200))
	r.Use(gzip.Gzip(gzip.DefaultCompression))

}
