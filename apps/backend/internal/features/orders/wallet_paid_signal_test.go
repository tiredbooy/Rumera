package orders

import (
	"context"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/tiredbooy/internal/events"
	"github.com/tiredbooy/internal/models"
)

// recordingEmitter captures the facts a rail emits.
type recordingEmitter struct {
	calls []events.OrderPaidData
}

func (r *recordingEmitter) OrderPaidTx(_ context.Context, _ pgx.Tx, d events.OrderPaidData) error {
	r.calls = append(r.calls, d)
	return nil
}
func (r *recordingEmitter) Enabled() bool { return true }

// A-5. The wallet rail writes no payment_transactions row on purpose, so
// order.paid.v1 is the ONLY signal that a wallet order was paid. Every
// post-payment feature hangs off that fact; if this emit is ever dropped or
// moved behind the gateway path, wallet buyers silently stop earning loyalty,
// firing referrals and producing recommendation signals — exactly the bug this
// architecture was introduced to fix.
//
// Nothing pinned this before: the wallet tests never wired an emitter, so
// emitOrderPaid returned nil without asserting anything.
func TestWalletRailEmitsTheOnlyPaidSignalItHas(t *testing.T) {
	orderRepo := &orderRepoStub{
		tx: &fakeTx{},
		createFn: func(context.Context, pgx.Tx, CreateOrderReq, int64, float64, float64, float64, float64, float64, []byte, bool, *int64) (*Order, error) {
			return &Order{ID: 100, TotalAmount: 59, Status: OrderStatusPending}, nil
		},
	}
	wallet := &walletPurchaserStub{}
	svc, payRepo := buildOrderServiceWired(orderRepo, nonEmptyCart(), &couponRepoStub{}, nil, &invRepoStub{}, wallet)

	emitter := &recordingEmitter{}
	AttachEventPublisher(svc, emitter)

	order, err := svc.CreateOrder(context.Background(), 7, CreateOrderReq{
		ShippingMethodID: 1, AddressID: 1, PaymentMethod: models.PaymentMethodWallet,
	})
	if err != nil {
		t.Fatalf("CreateOrder: %v", err)
	}

	// The invariant that makes the fact load-bearing: no gateway row exists.
	if payRepo.creates != 0 {
		t.Fatalf("wallet wrote %d payment_transactions rows; the rail is meant to write none", payRepo.creates)
	}
	if len(emitter.calls) != 1 {
		t.Fatalf("order.paid.v1 emitted %d times on the wallet rail; want exactly 1 — it is the only paid signal wallet has", len(emitter.calls))
	}
	got := emitter.calls[0]
	if got.OrderID != order.ID {
		t.Errorf("fact order id = %d, want %d", got.OrderID, order.ID)
	}
	if got.Rail != "wallet" {
		t.Errorf("rail = %q, want \"wallet\"", got.Rail)
	}
	// Consumers branch on this being absent; a fabricated id would point at a
	// payment_transactions row that does not exist.
	if got.PaymentID != nil {
		t.Errorf("wallet fact carried PaymentID %v; wallet has no gateway payment", *got.PaymentID)
	}
	if got.PaidAt.IsZero() {
		t.Error("fact carries no paid_at")
	}
}

// The mirror: a rail that does not settle must not announce that it did.
func TestNonWalletRailEmitsNoPaidFactAtCheckout(t *testing.T) {
	orderRepo := &orderRepoStub{
		tx: &fakeTx{},
		createFn: func(context.Context, pgx.Tx, CreateOrderReq, int64, float64, float64, float64, float64, float64, []byte, bool, *int64) (*Order, error) {
			return &Order{ID: 101, TotalAmount: 59, Status: OrderStatusPending}, nil
		},
	}
	svc, payRepo := buildOrderServiceWired(orderRepo, nonEmptyCart(), &couponRepoStub{}, nil, &invRepoStub{}, nil)

	emitter := &recordingEmitter{}
	AttachEventPublisher(svc, emitter)

	if _, err := svc.CreateOrder(context.Background(), 7, CreateOrderReq{
		ShippingMethodID: 1, AddressID: 1, PaymentMethod: models.PaymentMethodCard,
	}); err != nil {
		t.Fatalf("CreateOrder: %v", err)
	}

	if payRepo.creates != 1 {
		t.Fatalf("gateway rail wrote %d pending payment rows; want 1", payRepo.creates)
	}
	if len(emitter.calls) != 0 {
		t.Fatalf("gateway rail emitted order.paid.v1 at checkout (%d times); the order is not paid until Confirm", len(emitter.calls))
	}
}
