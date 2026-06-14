package middleware

import (
	"time"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel/trace"
	"go.uber.org/zap"
)

func Logger(log *zap.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		userID := c.GetString("user_id")

		c.Next()

		status := c.Writer.Status()
		fields := []zap.Field{
			zap.String("request_id", c.GetString(RequestIDKey)),
			zap.String("method", c.Request.Method),
			zap.String("path", c.Request.URL.Path),
			zap.String("query", c.Request.URL.RawQuery),
			zap.String("ip", c.ClientIP()),
			zap.Int("status", status),
			zap.Int("bytes", c.Writer.Size()),
			zap.Duration("latency", time.Since(start)),
			zap.String("user_agent", c.Request.UserAgent()),
			zap.String("user_id", userID),
			// trace_id joins this log line to its distributed trace. Empty when
			// tracing is disabled or no span is active on the request context.
			zap.String("trace_id", traceID(c)),
		}

		switch {
		case status >= 500:
			log.Error("request", fields...)
		case status >= 400:
			log.Warn("request", fields...)
		default:
			log.Info("request", fields...)
		}
	}
}

// traceID returns the active span's trace ID for the request, or "" when there
// is no sampled span (tracing disabled or no active trace).
func traceID(c *gin.Context) string {
	sc := trace.SpanContextFromContext(c.Request.Context())
	if !sc.HasTraceID() {
		return ""
	}
	return sc.TraceID().String()
}
