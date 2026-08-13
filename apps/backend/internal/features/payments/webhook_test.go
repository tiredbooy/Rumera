package payments

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/tiredbooy/internal/features/inventory"
	"github.com/tiredbooy/internal/models"
)

func signBody(body []byte, secret string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(body)
	return hex.EncodeToString(mac.Sum(nil))
}

func TestValidSignature(t *testing.T) {
	body := []byte(`{"transaction_id":"abc","status":"succeeded"}`)
	secret := "whsec_test"

	tests := []struct {
		name     string
		provided string
		want     bool
	}{
		{"valid", signBody(body, secret), true},
		{"empty", "", false},
		{"wrong secret", signBody(body, "other"), false},
		{"tampered", signBody([]byte(`{"transaction_id":"abc","status":"failed"}`), secret), false},
		{"garbage", "not-hex", false},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := validSignature(body, tc.provided, secret); got != tc.want {
				t.Fatalf("validSignature(%q) = %v, want %v", tc.name, got, tc.want)
			}
		})
	}
}

// webhookRepo drives Confirm/Fail/GetByTransactionID for webhook HTTP tests.
type webhookRepo struct {
	rows         map[string]*PaymentTransaction
	confirmCalls atomic.Int32
	failCalls    atomic.Int32
}

func newWebhookRepo(initial ...*PaymentTransaction) *webhookRepo {
	r := &webhookRepo{rows: map[string]*PaymentTransaction{}}
	for _, pt := range initial {
		cp := *pt
		r.rows[pt.TransactionID] = &cp
	}
	return r
}

func (r *webhookRepo) BeginTx(context.Context) (pgx.Tx, error) {
	return &fakeTx{}, nil
}

func (r *webhookRepo) Create(context.Context, pgx.Tx, CreatePaymentTransactionReq) (*PaymentTransaction, error) {
	return nil, models.ErrConflict
}

func (r *webhookRepo) GetByID(context.Context, int64) (*PaymentTransaction, error) {
	return nil, models.ErrNotFound
}

func (r *webhookRepo) GetByTransactionID(_ context.Context, txid string) (*PaymentTransaction, error) {
	pt, ok := r.rows[txid]
	if !ok {
		return nil, models.ErrNotFound
	}
	cp := *pt
	return &cp, nil
}

func (r *webhookRepo) GetAll(context.Context, PaymentTransactionFilter) ([]*PaymentTransaction, int64, error) {
	return nil, 0, nil
}

func (r *webhookRepo) Confirm(_ context.Context, _ pgx.Tx, req ConfirmPaymentReq) (*PaymentTransaction, error) {
	r.confirmCalls.Add(1)
	pt, ok := r.rows[req.TransactionID]
	if !ok || pt.Status != PaymentStatusPending {
		return nil, models.ErrNotFound
	}
	pt.Status = PaymentStatusSucceeded
	cp := *pt
	return &cp, nil
}

func (r *webhookRepo) Fail(_ context.Context, req FailPaymentReq) (*PaymentTransaction, error) {
	r.failCalls.Add(1)
	pt, ok := r.rows[req.TransactionID]
	if !ok || pt.Status != PaymentStatusPending {
		return nil, models.ErrNotFound
	}
	pt.Status = PaymentStatusFailed
	cp := *pt
	return &cp, nil
}

// orderMarkPaidStub satisfies OrderMarkPaid for Confirm success path.
type orderMarkPaidStub struct{}

func (orderMarkPaidStub) MarkAsPaid(context.Context, pgx.Tx, int64) error { return nil }
func (orderMarkPaidStub) GetStockLines(context.Context, int64) ([]inventory.StockLine, error) {
	return nil, nil
}

func postWebhook(h *Handler, body, secret string) *httptest.ResponseRecorder {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.POST("/webhooks/payment", h.PaymentWebhook)

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/webhooks/payment", bytes.NewReader([]byte(body)))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Webhook-Signature", signBody([]byte(body), secret))
	r.ServeHTTP(w, req)
	return w
}

func TestPaymentWebhook_Succeeded_ThenReplay_ACKsWithoutReConfirm(t *testing.T) {
	const secret = "whsec_replay_test"
	oid := int64(99)
	uid := int64(7)
	repo := newWebhookRepo(&PaymentTransaction{
		ID:            1,
		OrderID:       &oid,
		UserID:        &uid,
		Amount:        12000,
		Status:        PaymentStatusPending,
		TransactionID: "gw-tx-replay-1",
	})
	svc := NewService(repo, orderMarkPaidStub{}, nil, nil, nil, nil, nil)
	h := &Handler{Payments: svc, WebhookSecret: secret}

	body := `{"transaction_id":"gw-tx-replay-1","status":"succeeded"}`

	first := postWebhook(h, body, secret)
	if first.Code != http.StatusOK {
		t.Fatalf("first status = %d body=%s", first.Code, first.Body.String())
	}
	if repo.confirmCalls.Load() != 1 {
		t.Fatalf("confirm calls after first = %d; want 1", repo.confirmCalls.Load())
	}

	// Gateway redelivery: Confirm is pending-only → ErrNotFound, but row is
	// terminal succeeded → handler ACKs 200 with replayed=true (PH-011d).
	second := postWebhook(h, body, secret)
	if second.Code != http.StatusOK {
		t.Fatalf("replay status = %d body=%s; want 200 ACK", second.Code, second.Body.String())
	}
	if !bytes.Contains(second.Body.Bytes(), []byte(`"replayed"`)) {
		t.Fatalf("replay body = %s; want replayed marker", second.Body.String())
	}
	// Confirm attempted again (pending-only fails) — side effect did not re-apply
	// because repo only transitions pending → succeeded once.
	if repo.confirmCalls.Load() != 2 {
		t.Fatalf("confirm calls after replay = %d; want 2 attempts (second is no-op)", repo.confirmCalls.Load())
	}
	pt, err := repo.GetByTransactionID(context.Background(), "gw-tx-replay-1")
	if err != nil || pt.Status != PaymentStatusSucceeded {
		t.Fatalf("status after replay = %v err=%v; want succeeded", pt, err)
	}
}

func TestPaymentWebhook_Failed_ThenReplay_ACKs(t *testing.T) {
	const secret = "whsec_fail_replay"
	oid := int64(11)
	repo := newWebhookRepo(&PaymentTransaction{
		ID:            2,
		OrderID:       &oid,
		Status:        PaymentStatusPending,
		TransactionID: "gw-tx-fail-1",
	})
	svc := NewService(repo, orderMarkPaidStub{}, nil, nil, nil, nil, nil)
	h := &Handler{Payments: svc, WebhookSecret: secret}

	body := `{"transaction_id":"gw-tx-fail-1","status":"failed","error_message":"declined"}`
	if got := postWebhook(h, body, secret).Code; got != http.StatusOK {
		t.Fatalf("first fail status = %d", got)
	}
	if repo.failCalls.Load() != 1 {
		t.Fatalf("fail calls = %d; want 1", repo.failCalls.Load())
	}

	second := postWebhook(h, body, secret)
	if second.Code != http.StatusOK {
		t.Fatalf("fail replay status = %d; want 200", second.Code)
	}
	if repo.failCalls.Load() != 2 {
		t.Fatalf("fail attempts = %d; want 2 (second no-op)", repo.failCalls.Load())
	}
	pt, _ := repo.GetByTransactionID(context.Background(), "gw-tx-fail-1")
	if pt.Status != PaymentStatusFailed {
		t.Fatalf("status = %s; want failed", pt.Status)
	}
}

// releaseSpy records stock release after payment fail (webhook compensation).
type releaseSpy struct {
	calls atomic.Int32
	last  int64
	lines []inventory.StockLine
}

func (s *releaseSpy) ReleaseForOrder(_ context.Context, orderID int64, items []inventory.StockLine) error {
	s.calls.Add(1)
	s.last = orderID
	s.lines = append([]inventory.StockLine(nil), items...)
	return nil
}

type stockLinesStub struct {
	lines []inventory.StockLine
}

func (s stockLinesStub) GetOrderStockLines(context.Context, int64) ([]inventory.StockLine, error) {
	return s.lines, nil
}

func TestPaymentWebhook_Failed_ReleasesReservedStock(t *testing.T) {
	const secret = "whsec_fail_release"
	oid := int64(42)
	repo := newWebhookRepo(&PaymentTransaction{
		ID:            3,
		OrderID:       &oid,
		Status:        PaymentStatusPending,
		TransactionID: "gw-tx-fail-release",
	})
	svc := NewService(repo, orderMarkPaidStub{}, nil, nil, nil, nil, nil)
	inv := &releaseSpy{}
	h := &Handler{
		Payments:      svc,
		Orders:        stockLinesStub{lines: []inventory.StockLine{{VariantID: 9, Quantity: 2}}},
		Inventory:     inv,
		WebhookSecret: secret,
	}

	body := `{"transaction_id":"gw-tx-fail-release","status":"failed","error_message":"declined"}`
	if got := postWebhook(h, body, secret).Code; got != http.StatusOK {
		t.Fatalf("status = %d", got)
	}
	if inv.calls.Load() != 1 {
		t.Fatalf("ReleaseForOrder calls = %d; want 1 after fail", inv.calls.Load())
	}
	if inv.last != oid {
		t.Fatalf("released order = %d; want %d", inv.last, oid)
	}
	if len(inv.lines) != 1 || inv.lines[0].VariantID != 9 || inv.lines[0].Quantity != 2 {
		t.Fatalf("released lines = %+v", inv.lines)
	}

	// Terminal replay must not release again (Fail is pending-only → ACK path).
	if got := postWebhook(h, body, secret).Code; got != http.StatusOK {
		t.Fatalf("replay status = %d", got)
	}
	if inv.calls.Load() != 1 {
		t.Fatalf("ReleaseForOrder after replay = %d; want still 1", inv.calls.Load())
	}
}

func TestPaymentWebhook_UnknownTransaction_NotFound(t *testing.T) {
	const secret = "whsec_unknown"
	repo := newWebhookRepo()
	svc := NewService(repo, orderMarkPaidStub{}, nil, nil, nil, nil, nil)
	h := &Handler{Payments: svc, WebhookSecret: secret}

	body := `{"transaction_id":"does-not-exist","status":"succeeded"}`
	w := postWebhook(h, body, secret)
	if w.Code != http.StatusNotFound {
		// Confirm → ErrNotFound, no terminal row → surface not found (not ACK).
		t.Fatalf("status = %d; want 404 for unknown txid", w.Code)
	}
}

func TestPaymentWebhook_BadSignature(t *testing.T) {
	h := &Handler{
		Payments:      NewService(newWebhookRepo(), nil, nil, nil, nil, nil, nil),
		WebhookSecret: "secret",
	}
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.POST("/webhooks/payment", h.PaymentWebhook)
	w := httptest.NewRecorder()
	body := `{"transaction_id":"x","status":"succeeded"}`
	req := httptest.NewRequest(http.MethodPost, "/webhooks/payment", bytes.NewReader([]byte(body)))
	req.Header.Set("X-Webhook-Signature", "deadbeef")
	r.ServeHTTP(w, req)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d; want 401", w.Code)
	}
}
