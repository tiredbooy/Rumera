package middlewares

import (
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/tiredbooy/pkg/cache"
	"github.com/tiredbooy/pkg/response"
)

// LoginRateLimit throttles sensitive auth endpoints (login, register, password
// reset request) per client IP using a Redis fixed-window counter. It blunts
// credential-stuffing and brute-force attempts without affecting normal users.
//
// It degrades open: if no cache is configured, or Redis errors, the request is
// allowed through — availability of auth is preferred over a hard dependency on
// Redis for every login.
func LoginRateLimit(store cache.Store, max int64, window time.Duration) gin.HandlerFunc {
	return func(c *gin.Context) {
		if store == nil {
			c.Next()
			return
		}
		key := cache.KeyLoginAttempts(c.ClientIP())
		n, err := store.Incr(c.Request.Context(), key, window)
		if err != nil {
			c.Next()
			return
		}
		if n > max {
			// Surface how long until the window resets, when we can read it.
			if ttl, err := store.TTL(c.Request.Context(), key); err == nil && ttl > 0 {
				c.Header("Retry-After", strconv.Itoa(int(ttl.Seconds())))
			}
			response.TooManyRequests(c)
			c.Abort()
			return
		}
		c.Next()
	}
}
