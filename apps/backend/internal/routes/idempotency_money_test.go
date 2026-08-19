package routes

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
	"github.com/tiredbooy/internal/features/giftcard"
	"github.com/tiredbooy/internal/features/loyalty"
	"github.com/tiredbooy/internal/features/orders"
	"github.com/tiredbooy/internal/features/payments"
	"github.com/tiredbooy/internal/features/wallet"
	"github.com/tiredbooy/pkg/middleware"
	"go.uber.org/zap"
)

// testIdemStore is an in-memory IdempotencyStore for route-wiring tests.
type testIdemStore struct {
	mu   sync.Mutex
	recs map[string]*middleware.IdempotencyRecord
}

func newTestIdemStore() *testIdemStore {
	return &testIdemStore{recs: map[string]*middleware.IdempotencyRecord{}}
}

func (m *testIdemStore) Claim(_ context.Context, key, hash string) (bool, *middleware.IdempotencyRecord, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if r, ok := m.recs[key]; ok {
		cp := *r
		if cp.ResponseBody != nil {
			cp.ResponseBody = append([]byte(nil), cp.ResponseBody...)
		}
		return false, &cp, nil
	}
	m.recs[key] = &middleware.IdempotencyRecord{
		RequestHash:  hash,
		ResponseCode: 0,
		CreatedAt:    time.Now(),
	}
	return true, nil, nil
}

func (m *testIdemStore) Complete(_ context.Context, key string, code int, body []byte) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if r, ok := m.recs[key]; ok {
		r.ResponseCode = code
		r.ResponseBody = append([]byte(nil), body...)
	}
	return nil
}

func (m *testIdemStore) Release(_ context.Context, key string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.recs, key)
	return nil
}

func countingHandler(calls *atomic.Int32, payload string) gin.HandlerFunc {
	return func(c *gin.Context) {
		calls.Add(1)
		c.Data(http.StatusOK, "application/json; charset=utf-8", []byte(payload))
	}
}

// buildMoneyBehaviourEngine mirrors production P0 mounts and policies:
// webhook AllowAutoKey=true; money routes AllowAutoKey=false (PH-011c).
func buildMoneyBehaviourEngine(store middleware.IdempotencyStore, calls map[string]*atomic.Int32) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	log := zap.NewNop()

	webhookIdem := middleware.Idempotency(store, log)
	moneyIdem := middleware.IdempotencyWithConfig(store, log, middleware.IdempotencyConfig{
		AllowAutoKey: false,
		RequireKey:   false,
	})

	authStub := func(c *gin.Context) {
		if uid := c.GetHeader("X-Test-UID"); uid != "" {
			var id int64
			for _, ch := range uid {
				if ch < '0' || ch > '9' {
					continue
				}
				id = id*10 + int64(ch-'0')
			}
			c.Set("uid", id)
		}
		c.Next()
	}

	v1 := r.Group("/api/v1")
	v1.POST("/webhooks/payment", webhookIdem, countingHandler(calls["webhook"], `{"ok":"webhook"}`))

	cust := v1.Group("")
	cust.Use(authStub)
	cust.POST("/orders", moneyIdem, countingHandler(calls["orders"], `{"ok":"order"}`))
	cust.POST("/gift-cards/redeem", moneyIdem, countingHandler(calls["gift"], `{"ok":"gift"}`))
	cust.POST("/loyalty/redeem", moneyIdem, countingHandler(calls["loyalty"], `{"ok":"loyalty"}`))

	admin := v1.Group("/admin")
	admin.Use(authStub)
	admin.POST("/users/:userID/wallet/credit", moneyIdem, countingHandler(calls["wallet"], `{"ok":"credit"}`))

	return r
}

func newCallMap() map[string]*atomic.Int32 {
	return map[string]*atomic.Int32{
		"webhook": {},
		"orders":  {},
		"gift":    {},
		"loyalty": {},
		"wallet":  {},
	}
}

func postMoney(r *gin.Engine, path, body, key, uid string) *httptest.ResponseRecorder {
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, path, bytes.NewBufferString(body))
	if key != "" {
		req.Header.Set("Idempotency-Key", key)
	}
	if uid != "" {
		req.Header.Set("X-Test-UID", uid)
	}
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	return w
}

// TestMoneyRoutes_DoublePOST_OneSideEffect is the PH-011c acceptance:
// same Idempotency-Key + same body on each P0 money route runs the handler once.
func TestMoneyRoutes_DoublePOST_OneSideEffect(t *testing.T) {
	store := newTestIdemStore()
	calls := newCallMap()
	r := buildMoneyBehaviourEngine(store, calls)

	cases := []struct {
		name string
		path string
		body string
		key  string
		uid  string
		call string
	}{
		{"orders", "/api/v1/orders", `{"address_id":1}`, "order-key-01", "42", "orders"},
		{"gift_redeem", "/api/v1/gift-cards/redeem", `{"code":"ABCD-EFGH-JKLM-NPQR"}`, "gift-key-01", "42", "gift"},
		{"loyalty_redeem", "/api/v1/loyalty/redeem", `{"points":100}`, "loyal-key-1", "42", "loyalty"},
		{"admin_credit", "/api/v1/admin/users/7/wallet/credit", `{"amount":50000,"idempotency_key":"admin-key-1"}`, "admin-key-1", "9", "wallet"},
		{"webhook_auto", "/api/v1/webhooks/payment", `{"transaction_id":"tx-abc","status":"success"}`, "", "", "webhook"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			before := calls[tc.call].Load()
			first := postMoney(r, tc.path, tc.body, tc.key, tc.uid)
			if first.Code != http.StatusOK {
				t.Fatalf("first status = %d body=%s", first.Code, first.Body.String())
			}
			second := postMoney(r, tc.path, tc.body, tc.key, tc.uid)
			if second.Code != http.StatusOK {
				t.Fatalf("replay status = %d body=%s", second.Code, second.Body.String())
			}
			if second.Body.String() != first.Body.String() {
				t.Fatalf("replay body mismatch: got %q want %q", second.Body.String(), first.Body.String())
			}
			got := calls[tc.call].Load() - before
			if got != 1 {
				t.Fatalf("handler ran %d times; want exactly 1 (double-POST must not re-run side effect)", got)
			}
		})
	}
}

// TestMoneyRoutes_MissingKey_NoCache still processes (RequireKey=false) twice.
func TestMoneyRoutes_MissingKey_NoCache(t *testing.T) {
	store := newTestIdemStore()
	calls := newCallMap()
	r := buildMoneyBehaviourEngine(store, calls)

	body := `{"address_id":2}`
	if got := postMoney(r, "/api/v1/orders", body, "", "42").Code; got != http.StatusOK {
		t.Fatalf("first = %d", got)
	}
	if got := postMoney(r, "/api/v1/orders", body, "", "42").Code; got != http.StatusOK {
		t.Fatalf("second = %d", got)
	}
	if calls["orders"].Load() != 2 {
		t.Fatalf("without key handler ran %d; want 2 (no platform cache)", calls["orders"].Load())
	}
	if len(store.recs) != 0 {
		for k := range store.recs {
			t.Fatalf("unexpected store key %q when Idempotency-Key omitted on money route", k)
		}
	}
}

// TestFeatureRegister_MoneyIdemWiring ensures production Register* signatures
// accept money middleware and register all P0 paths.
func TestFeatureRegister_MoneyIdemWiring(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	store := newTestIdemStore()
	moneyIdem := middleware.IdempotencyWithConfig(store, zap.NewNop(), middleware.IdempotencyConfig{
		AllowAutoKey: false,
	})
	webhookIdem := middleware.Idempotency(store, zap.NewNop())

	v1 := r.Group("/api/v1")
	cust := v1.Group("")
	admin := v1.Group("/admin")

	payments.RegisterPublic(v1, &payments.Handler{}, webhookIdem)
	orders.RegisterCustomer(cust, &orders.Handler{}, moneyIdem)
	giftcard.RegisterCustomer(cust, &giftcard.Handler{}, moneyIdem)
	loyalty.RegisterCustomer(cust, &loyalty.Handler{}, moneyIdem)
	loyalty.RegisterAdmin(admin, admin, admin, &loyalty.Handler{}, moneyIdem)
	wallet.RegisterCustomer(cust, &wallet.Handler{}, moneyIdem)
	wallet.RegisterAdmin(admin, admin, &wallet.Handler{}, moneyIdem)

	want := map[string]bool{
		"POST /api/v1/webhooks/payment":                   false,
		"POST /api/v1/orders":                             false,
		"POST /api/v1/gift-cards/redeem":                  false,
		"POST /api/v1/gift-cards/purchase":                false,
		"POST /api/v1/loyalty/redeem":                     false,
		"POST /api/v1/wallet/topup":                       false,
		"POST /api/v1/admin/users/:userID/wallet/credit":  false,
		"POST /api/v1/admin/users/:userID/loyalty/adjust": false,
	}
	for _, route := range r.Routes() {
		key := route.Method + " " + route.Path
		if _, ok := want[key]; ok {
			want[key] = true
		}
	}
	for path, found := range want {
		if !found {
			t.Errorf("expected P0 money path %s registered", path)
		}
	}
}
