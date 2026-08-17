package middlewares

import (
	"strconv"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/tiredbooy/pkg/cache"
	"github.com/tiredbooy/pkg/response"
)

// LoginRateLimit throttles sensitive auth endpoints (login, register, password
// forgot/validate/reset, OTP, refresh, logout) per client IP. It prefers a
// Redis fixed-window counter (shared across instances), but no longer fails
// fully open when Redis is unavailable: if the cache is absent or errors, it
// falls back to a per-instance in-memory limiter so credential-stuffing
// protection survives a cache outage.
func LoginRateLimit(store cache.Store, max int64, window time.Duration) gin.HandlerFunc {
	fallback := newMemLimiter()

	return func(c *gin.Context) {
		ip := c.ClientIP()

		if store != nil {
			key := cache.KeyLoginAttempts(ip)
			n, err := store.Incr(c.Request.Context(), key, window)
			if err == nil {
				if n > max {
					if ttl, terr := store.TTL(c.Request.Context(), key); terr == nil && ttl > 0 {
						c.Header("Retry-After", strconv.Itoa(int(ttl.Seconds())))
					}
					response.TooManyRequests(c)
					c.Abort()
					return
				}
				c.Next()
				return
			}
			// Redis errored — fall through to the in-memory limiter instead of
			// allowing the request unconditionally.
		}

		if !fallback.allow(ip, max, window) {
			response.TooManyRequests(c)
			c.Abort()
			return
		}
		c.Next()
	}
}

// memLimiter is a tiny per-IP fixed-window counter used as a degraded fallback
// when the Redis limiter is unavailable. It is per-process (not shared across
// instances), which is acceptable for a fallback: less strict than Redis, but
// far better than no limiting at all.
type memLimiter struct {
	mu   sync.Mutex
	hits map[string]*winCounter
}

type winCounter struct {
	count   int64
	resetAt time.Time
}

func newMemLimiter() *memLimiter {
	return &memLimiter{hits: make(map[string]*winCounter)}
}

// allow records a hit for key and reports whether it is within max per window.
func (m *memLimiter) allow(key string, max int64, window time.Duration) bool {
	now := time.Now()

	m.mu.Lock()
	defer m.mu.Unlock()

	// Opportunistically prune expired entries so the map can't grow unbounded
	// under a flood of distinct (possibly spoofed) IPs.
	if len(m.hits) > 10000 {
		for k, w := range m.hits {
			if now.After(w.resetAt) {
				delete(m.hits, k)
			}
		}
	}

	w := m.hits[key]
	if w == nil || now.After(w.resetAt) {
		m.hits[key] = &winCounter{count: 1, resetAt: now.Add(window)}
		return true
	}
	w.count++
	return w.count <= max
}
