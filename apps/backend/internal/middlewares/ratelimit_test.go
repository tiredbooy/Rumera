package middlewares

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

func TestMemLimiter_AllowsUpToMaxThenBlocks(t *testing.T) {
	m := newMemLimiter()
	const max = 3
	for i := 1; i <= max; i++ {
		if !m.allow("1.2.3.4", max, time.Minute) {
			t.Fatalf("hit %d should be allowed", i)
		}
	}
	if m.allow("1.2.3.4", max, time.Minute) {
		t.Fatal("hit max+1 should be blocked")
	}
}

func TestMemLimiter_SeparatesKeys(t *testing.T) {
	m := newMemLimiter()
	if !m.allow("a", 1, time.Minute) || !m.allow("b", 1, time.Minute) {
		t.Fatal("distinct keys should each get their own window")
	}
	if m.allow("a", 1, time.Minute) {
		t.Fatal("key a is over its limit")
	}
}

func TestMemLimiter_WindowResets(t *testing.T) {
	m := newMemLimiter()
	if !m.allow("x", 1, time.Millisecond) {
		t.Fatal("first hit allowed")
	}
	if m.allow("x", 1, time.Millisecond) {
		t.Fatal("second hit within window blocked")
	}
	time.Sleep(2 * time.Millisecond)
	if !m.allow("x", 1, time.Millisecond) {
		t.Fatal("after the window the counter should reset")
	}
}

// With no Redis store the middleware must fall back to the in-memory limiter and
// still return 429 past the limit — the previous behaviour failed fully open.
func TestLoginRateLimit_FailsClosedWithoutRedis(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.POST("/login", LoginRateLimit(nil, 2, time.Minute), func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	do := func() int {
		w := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodPost, "/login", nil)
		req.RemoteAddr = "9.9.9.9:1234"
		r.ServeHTTP(w, req)
		return w.Code
	}

	if c := do(); c != http.StatusOK {
		t.Fatalf("hit 1: got %d, want 200", c)
	}
	if c := do(); c != http.StatusOK {
		t.Fatalf("hit 2: got %d, want 200", c)
	}
	if c := do(); c != http.StatusTooManyRequests {
		t.Fatalf("hit 3: got %d, want 429", c)
	}
}

// Password-validate is GET; the same helper must throttle any method.
func TestLoginRateLimit_FailsClosedOnGET(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.GET("/password/validate", LoginRateLimit(nil, 2, time.Minute), func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	do := func() int {
		w := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/password/validate", nil)
		req.RemoteAddr = "9.9.9.9:1234"
		r.ServeHTTP(w, req)
		return w.Code
	}

	if c := do(); c != http.StatusOK {
		t.Fatalf("hit 1: got %d, want 200", c)
	}
	if c := do(); c != http.StatusOK {
		t.Fatalf("hit 2: got %d, want 200", c)
	}
	if c := do(); c != http.StatusTooManyRequests {
		t.Fatalf("hit 3: got %d, want 429", c)
	}
}
