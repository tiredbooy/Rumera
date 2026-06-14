package middleware

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// memStore is an in-memory IdempotencyStore for tests.
type memStore struct {
	mu   sync.Mutex
	recs map[string]*IdempotencyRecord
}

func newMemStore() *memStore { return &memStore{recs: map[string]*IdempotencyRecord{}} }

func (m *memStore) Claim(_ context.Context, key, hash string) (bool, *IdempotencyRecord, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if r, ok := m.recs[key]; ok {
		cp := *r
		return false, &cp, nil
	}
	m.recs[key] = &IdempotencyRecord{RequestHash: hash, ResponseCode: 0}
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
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/webhooks/payment", bytes.NewBufferString(body))
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
