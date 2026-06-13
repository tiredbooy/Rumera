package middleware

import (
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/tiredbooy/pkg/response"
	"golang.org/x/time/rate"
)

type visitor struct {
	limiter  *rate.Limiter
	lastSeen time.Time
}

type ipLimiter struct {
	mu       sync.Mutex
	visitors map[string]*visitor
	r        rate.Limit
	burst    int
}

func newIPLimiter(r rate.Limit, burst int) *ipLimiter {
	il := &ipLimiter{
		visitors: make(map[string]*visitor),
		r:        r,
		burst:    burst,
	}

	go il.cleanup(3 * time.Minute)
	return il
}

func (il *ipLimiter) get(ip string) *rate.Limiter {
	il.mu.Lock()
	defer il.mu.Unlock()

	v, exists := il.visitors[ip]
	if !exists {
		limiter := rate.NewLimiter(il.r, il.burst)
		il.visitors[ip] = &visitor{limiter: limiter, lastSeen: time.Now()}
		return limiter
	}

	v.lastSeen = time.Now()
	return v.limiter
}

func (il *ipLimiter) cleanup(interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for range ticker.C {
		il.mu.Lock()
		for ip, v := range il.visitors {
			if time.Since(v.lastSeen) > interval {
				delete(il.visitors, ip)
			}
		}
		il.mu.Unlock()
	}
}

func RateLimit(r rate.Limit, burst int) gin.HandlerFunc {
	limiter := newIPLimiter(r, burst)

	return func(c *gin.Context) {
		ip := c.ClientIP()
		if !limiter.get(ip).Allow() {
			c.Header("Retry-After", "1")
			response.Error(c, response.ErrTooManyRequests)
			c.Abort()
			return
		}
		c.Next()
	}
}
