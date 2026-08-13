package middleware

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// memStore is an in-memory IdempotencyStore for tests (includes stale reclaim).
type memStore struct {
	mu         sync.Mutex
	recs       map[string]*IdempotencyRecord
	staleAfter time.Duration
	now        func() time.Time
}

func newMemStore() *memStore {
	return &memStore{
		recs:       map[string]*IdempotencyRecord{},
		staleAfter: DefaultIdempotencyStaleAfter,
		now:        time.Now,
	}
}

func (m *memStore) Claim(_ context.Context, key, hash string) (bool, *IdempotencyRecord, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if r, ok := m.recs[key]; ok {
		if r.ResponseCode == 0 && m.staleAfter > 0 {
			cutoff := m.now().Add(-m.staleAfter)
			if r.CreatedAt.Before(cutoff) {
				delete(m.recs, key)
				m.recs[key] = &IdempotencyRecord{RequestHash: hash, ResponseCode: 0, CreatedAt: m.now()}
				return true, nil, nil
			}
		}
		cp := *r
		if cp.ResponseBody != nil {
			cp.ResponseBody = append([]byte(nil), cp.ResponseBody...)
		}
		return false, &cp, nil
	}
	m.recs[key] = &IdempotencyRecord{RequestHash: hash, ResponseCode: 0, CreatedAt: m.now()}
	return true, nil, nil
}

func (m *memStore) Complete(_ context.Context, key string, code int, body []byte) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if r, ok := m.recs[key]; ok {
		r.ResponseCode = code
		r.ResponseBody = append([]byte(nil), body...)
	}
	return nil
}

func (m *memStore) Release(_ context.Context, key string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.recs, key)
	return nil
}

// newRouter builds a gin engine with the idempotency middleware and a handler
// that counts how many times it actually runs.
func newRouter(store IdempotencyStore, calls *int) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.POST("/webhooks/payment", Idempotency(store, zap.NewNop()), func(c *gin.Context) {
		*calls++
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})
	return r
}

func do(r *gin.Engine, body string) *httptest.ResponseRecorder {
	return doWithKey(r, body, "")
}

func doWithKey(r *gin.Engine, body, key string) *httptest.ResponseRecorder {
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/webhooks/payment", bytes.NewBufferString(body))
	if key != "" {
		req.Header.Set("Idempotency-Key", key)
	}
	r.ServeHTTP(w, req)
	return w
}

func TestIdempotency_ReplayProcessesOnce(t *testing.T) {
	store := newMemStore()
	calls := 0
	r := newRouter(store, &calls)

	first := do(r, `{"transaction_id":"tx-1"}`)
	if first.Code != http.StatusOK {
		t.Fatalf("first call status = %d; want 200", first.Code)
	}

	second := do(r, `{"transaction_id":"tx-1"}`) // identical replay
	if second.Code != http.StatusOK {
		t.Fatalf("replay status = %d; want 200", second.Code)
	}
	if second.Body.String() != first.Body.String() {
		t.Fatalf("replay body = %q; want stored %q", second.Body.String(), first.Body.String())
	}
	if calls != 1 {
		t.Fatalf("handler ran %d times; want exactly 1 (side effect must not repeat)", calls)
	}
}

func TestIdempotency_DistinctBodiesBothProcess(t *testing.T) {
	store := newMemStore()
	calls := 0
	r := newRouter(store, &calls)

	do(r, `{"transaction_id":"tx-1"}`)
	do(r, `{"transaction_id":"tx-2"}`) // different payload → different derived key

	if calls != 2 {
		t.Fatalf("handler ran %d times; want 2 (distinct requests)", calls)
	}
}

func TestIdempotency_FailedHandlerReleasesClaim(t *testing.T) {
	store := newMemStore()
	gin.SetMode(gin.TestMode)

	attempt := 0
	r := gin.New()
	r.POST("/webhooks/payment", Idempotency(store, zap.NewNop()), func(c *gin.Context) {
		attempt++
		if attempt == 1 {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "boom"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})

	if got := do(r, `{"transaction_id":"tx-1"}`).Code; got != http.StatusInternalServerError {
		t.Fatalf("first status = %d; want 500", got)
	}
	// The failed attempt released its claim, so a retry re-processes and succeeds.
	if got := do(r, `{"transaction_id":"tx-1"}`).Code; got != http.StatusOK {
		t.Fatalf("retry status = %d; want 200 (claim should have been released)", got)
	}
	if attempt != 2 {
		t.Fatalf("handler ran %d times; want 2 (retry after failure)", attempt)
	}
}

func TestIdempotency_SameKeyDifferentBody_Conflict(t *testing.T) {
	store := newMemStore()
	calls := 0
	r := newRouter(store, &calls)

	key := "client-key-01"
	if got := doWithKey(r, `{"a":1}`, key).Code; got != http.StatusOK {
		t.Fatalf("first status = %d; want 200", got)
	}
	second := doWithKey(r, `{"a":2}`, key)
	if second.Code != http.StatusConflict {
		t.Fatalf("second status = %d; want 409 body conflict", second.Code)
	}
	if calls != 1 {
		t.Fatalf("handler ran %d times; want 1", calls)
	}
}

func TestIdempotency_InFlight_Conflict(t *testing.T) {
	store := newMemStore()
	// Disable stale reclaim so a held claim stays in-flight.
	store.staleAfter = 0

	gin.SetMode(gin.TestMode)
	started := make(chan struct{})
	release := make(chan struct{})
	var calls atomic.Int32

	r := gin.New()
	r.POST("/webhooks/payment", Idempotency(store, zap.NewNop()), func(c *gin.Context) {
		calls.Add(1)
		close(started)
		<-release
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})

	key := "inflight-key-1"
	done := make(chan *httptest.ResponseRecorder, 1)
	go func() {
		done <- doWithKey(r, `{"x":1}`, key)
	}()

	<-started
	// Concurrent retry while first still holds the claim.
	conflict := doWithKey(r, `{"x":1}`, key)
	if conflict.Code != http.StatusConflict {
		t.Fatalf("inflight status = %d; want 409", conflict.Code)
	}
	close(release)
	first := <-done
	if first.Code != http.StatusOK {
		t.Fatalf("first status = %d; want 200", first.Code)
	}
	if calls.Load() != 1 {
		t.Fatalf("handler ran %d times; want 1", calls.Load())
	}
}

func TestIdempotency_ScopedKeys_DifferentPrincipalsSameClientKey(t *testing.T) {
	store := newMemStore()
	gin.SetMode(gin.TestMode)
	var calls atomic.Int32

	r := gin.New()
	r.POST("/api/v1/orders", func(c *gin.Context) {
		// Simulate Auth middleware having run (uid in context).
		if uid := c.GetHeader("X-Test-UID"); uid != "" {
			var id int64
			for _, ch := range uid {
				id = id*10 + int64(ch-'0')
			}
			c.Set("uid", id)
		}
		c.Next()
	}, IdempotencyWithConfig(store, zap.NewNop(), IdempotencyConfig{AllowAutoKey: false}), func(c *gin.Context) {
		calls.Add(1)
		c.JSON(http.StatusOK, gin.H{"uid": c.GetInt64("uid")})
	})

	doOrder := func(uid, body, key string) *httptest.ResponseRecorder {
		w := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodPost, "/api/v1/orders", bytes.NewBufferString(body))
		req.Header.Set("Idempotency-Key", key)
		req.Header.Set("X-Test-UID", uid)
		r.ServeHTTP(w, req)
		return w
	}

	const sharedKey = "same-uuid-key-xx"
	if got := doOrder("1", `{"cart":1}`, sharedKey).Code; got != http.StatusOK {
		t.Fatalf("user1 status = %d; want 200", got)
	}
	if got := doOrder("2", `{"cart":1}`, sharedKey).Code; got != http.StatusOK {
		t.Fatalf("user2 status = %d; want 200 (scoped keys must not collide)", got)
	}
	if calls.Load() != 2 {
		t.Fatalf("handler ran %d times; want 2 (different principals)", calls.Load())
	}

	// Replay for user1 returns stored response without re-running.
	if got := doOrder("1", `{"cart":1}`, sharedKey).Code; got != http.StatusOK {
		t.Fatalf("user1 replay status = %d; want 200", got)
	}
	if calls.Load() != 2 {
		t.Fatalf("handler ran %d times after replay; want still 2", calls.Load())
	}
}

func TestIdempotency_StalePending_Reclaim(t *testing.T) {
	store := newMemStore()
	store.staleAfter = time.Minute
	base := time.Now()
	store.now = func() time.Time { return base }

	// Simulate a crashed worker: claim left pending.
	key := scopeIdempotencyKey("wh", "0", "POST", "/webhooks/payment", "stale-key-01")
	store.recs[key] = &IdempotencyRecord{
		RequestHash:  hashBody([]byte(`{"transaction_id":"tx-stale"}`)),
		ResponseCode: 0,
		CreatedAt:    base.Add(-2 * time.Minute),
	}

	calls := 0
	r := newRouter(store, &calls)
	// Advance "now" so Claim sees stale lease.
	store.now = func() time.Time { return base.Add(time.Second) }

	got := doWithKey(r, `{"transaction_id":"tx-stale"}`, "stale-key-01")
	if got.Code != http.StatusOK {
		t.Fatalf("status = %d; want 200 after stale reclaim", got.Code)
	}
	if calls != 1 {
		t.Fatalf("handler ran %d; want 1 after reclaim", calls)
	}
}

func TestIdempotency_RequireKey_Missing(t *testing.T) {
	store := newMemStore()
	gin.SetMode(gin.TestMode)
	calls := 0
	r := gin.New()
	r.POST("/api/v1/orders", IdempotencyWithConfig(store, zap.NewNop(), IdempotencyConfig{
		AllowAutoKey: false,
		RequireKey:   true,
	}), func(c *gin.Context) {
		calls++
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/orders", bytes.NewBufferString(`{}`))
	r.ServeHTTP(w, req)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d; want 400", w.Code)
	}
	if calls != 0 {
		t.Fatalf("handler must not run without required key")
	}
}

func TestIdempotency_OptionalKey_NoAuto_PassesThrough(t *testing.T) {
	store := newMemStore()
	gin.SetMode(gin.TestMode)
	calls := 0
	r := gin.New()
	r.POST("/api/v1/orders", IdempotencyWithConfig(store, zap.NewNop(), IdempotencyConfig{
		AllowAutoKey: false,
		RequireKey:   false,
	}), func(c *gin.Context) {
		calls++
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/orders", bytes.NewBufferString(`{}`))
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK || calls != 1 {
		t.Fatalf("status=%d calls=%d; want pass-through without cache", w.Code, calls)
	}
	if len(store.recs) != 0 {
		t.Fatalf("store should stay empty when key omitted and auto disabled")
	}
}

func TestIdempotency_InvalidClientKey(t *testing.T) {
	store := newMemStore()
	calls := 0
	r := newRouter(store, &calls)
	// Too short
	if got := doWithKey(r, `{}`, "short").Code; got != http.StatusBadRequest {
		t.Fatalf("short key status = %d; want 400", got)
	}
	// Whitespace
	if got := doWithKey(r, `{}`, "bad key!!").Code; got != http.StatusBadRequest {
		t.Fatalf("space key status = %d; want 400", got)
	}
	if calls != 0 {
		t.Fatalf("handler must not run on invalid key")
	}
}

func TestIdempotency_ConcurrentClaims_SingleWinner(t *testing.T) {
	store := newMemStore()
	gin.SetMode(gin.TestMode)
	var calls atomic.Int32
	var gate sync.WaitGroup
	gate.Add(1)

	r := gin.New()
	r.POST("/webhooks/payment", Idempotency(store, zap.NewNop()), func(c *gin.Context) {
		calls.Add(1)
		gate.Wait() // hold claim until all racers have tried
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})

	const n = 8
	const key = "race-key-001"
	results := make(chan int, n)
	var start sync.WaitGroup
	start.Add(n)
	for i := 0; i < n; i++ {
		go func() {
			start.Done()
			start.Wait()
			results <- doWithKey(r, `{"race":true}`, key).Code
		}()
	}
	start.Wait()
	// Let racers enter middleware; winner blocks in handler, losers should 409.
	time.Sleep(50 * time.Millisecond)
	gate.Done()

	var ok, conflict int
	for i := 0; i < n; i++ {
		code := <-results
		switch code {
		case http.StatusOK:
			ok++
		case http.StatusConflict:
			conflict++
		default:
			t.Fatalf("unexpected status %d", code)
		}
	}
	if ok != 1 {
		t.Fatalf("successes = %d; want exactly 1", ok)
	}
	if conflict != n-1 {
		t.Fatalf("conflicts = %d; want %d", conflict, n-1)
	}
	if calls.Load() != 1 {
		t.Fatalf("handler ran %d; want 1", calls.Load())
	}
}

func TestScopeIdempotencyKey_Format(t *testing.T) {
	got := scopeIdempotencyKey("cust", "42", "post", "/api/v1/orders", "abc-def-gh")
	want := "cust:42:POST:/api/v1/orders:abc-def-gh"
	if got != want {
		t.Fatalf("scope = %q; want %q", got, want)
	}
}

func TestValidClientIdempotencyKey(t *testing.T) {
	if !validClientIdempotencyKey("12345678") {
		t.Fatal("8 char key should be valid")
	}
	if validClientIdempotencyKey("1234567") {
		t.Fatal("7 char key should be invalid")
	}
	if validClientIdempotencyKey("has space1") {
		t.Fatal("space should be invalid")
	}
	if validClientIdempotencyKey("has|pipe1") {
		t.Fatal("pipe should be invalid")
	}
}
