package bootstrap

import (
	"time"

	"github.com/gin-contrib/gzip"
	"github.com/gin-gonic/gin"
	config "github.com/tiredbooy/configs"
	"github.com/tiredbooy/internal/middlewares"
	"github.com/tiredbooy/pkg/middleware"
	"go.opentelemetry.io/contrib/instrumentation/github.com/gin-gonic/gin/otelgin"
	"go.uber.org/zap"
	"golang.org/x/time/rate"
)

func setupMiddlewares(r *gin.Engine, cfg *config.Config, log *zap.Logger) {

	r.Use(middleware.Recovery(log))
	r.Use(middleware.RequestID())
	// Tracing wraps the rest of the chain so the root span covers the whole
	// request and its trace_id is in scope for the logger below. Gated: when
	// OTEL_ENABLED=false this middleware isn't installed at all.
	if cfg.OTELEnabled {
		r.Use(otelgin.Middleware(cfg.OTELServiceName))
	}
	// Security headers + CORS run early so they apply even to aborted requests.
	r.Use(middlewares.SecurityHeaders())
	r.Use(middlewares.CORS(cfg.CORSAllowedOrigins))
	r.Use(middleware.Logger(log))
	// Metrics capture runs right after logging so it times the full handler chain
	// (including rate-limit rejections and gzip), labelled by matched route.
	if cfg.MetricsEnabled {
		r.Use(middleware.Metrics())
	}
	// Cap request bodies before handlers allocate. Multipart gets a higher limit
	// so media uploads remain possible under MEDIA_MAX_UPLOAD_MB.
	multipartLimit := int64(cfg.MediaMaxUploadMB+2) * 1024 * 1024
	r.Use(middleware.MaxBodySize(middleware.DefaultJSONBodyLimit, multipartLimit))
	r.Use(middleware.Timeout(30 * time.Second))
	r.Use(middleware.RateLimit(rate.Limit(100), 200))
	r.Use(gzip.Gzip(gzip.DefaultCompression))

}
