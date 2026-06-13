package middleware

import (
	"time"

	"github.com/gin-gonic/gin"
	"github.com/tiredbooy/pkg/metrics"
)

// Metrics records a count and latency observation for every request once it has
// been handled. It labels by the matched route template (c.FullPath(), e.g.
// "/api/v1/products/:id") rather than the raw URL, so IDs in the path don't blow
// up label cardinality. Unmatched requests (404s) collapse into a single
// "unmatched" series for the same reason.
func Metrics() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		c.Next()

		route := c.FullPath()
		if route == "" {
			route = "unmatched"
		}
		metrics.ObserveHTTP(c.Request.Method, route, c.Writer.Status(), time.Since(start))
	}
}
