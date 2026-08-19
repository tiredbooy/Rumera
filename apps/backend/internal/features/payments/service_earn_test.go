package payments

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/tiredbooy/internal/features/inventory"
	"github.com/tiredbooy/internal/models"
)

// confirmEarnRepo records Confirm + in-memory earn-intent rows.
type confirmEarnRepo struct {
	pt      *PaymentTransaction
	tx      *fakeTx
	intents map[int64]*OrderEarnIntent
}

func (r *confirmEarnRepo) BeginTx(context.Context) (pgx.Tx, error) {
	r.tx = &fakeTx{}
	return r.tx, nil
}
func (r *confirmEarnRepo) Create(context.Context, pgx.Tx, CreatePaymentTransactionReq) (*PaymentTransaction, error) {
	return nil, models.ErrNotFound
}
func (r *confirmEarnRepo) GetByID(context.Context, int64) (*PaymentTransaction, error) {
	return nil, models.ErrNotFound
}
func (r *confirmEarnRepo) GetByTransactionID(context.Context, string) (*PaymentTransaction, error) {
	return r.pt, nil
}
func (r *confirmEarnRepo) GetAll(context.Context, PaymentTransactionFilter) ([]*PaymentTransaction, int64, error) {
	return nil, 0, nil
}
func (r *confirmEarnRepo) Confirm(_ context.Context, _ pgx.Tx, _ ConfirmPaymentReq) (*PaymentTransaction, error) {
	cp := *r.pt
	cp.Status = PaymentStatusSucceeded
	return &cp, nil
}
func (r *confirmEarnRepo) Fail(context.Context, FailPaymentReq) (*PaymentTransaction, error) {
	return nil, models.ErrNotFound
}
func (r *confirmEarnRepo) InsertEarnIntent(_ context.Context, _ pgx.Tx, intent OrderEarnIntent) error {
	if r.intents == nil {
		r.intents = map[int64]*OrderEarnIntent{}
	}
	if _, ok := r.intents[intent.OrderID]; ok {
		return nil
	}
	cp := intent
	r.intents[intent.OrderID] = &cp
	return nil
}
func (r *confirmEarnRepo) ListPendingEarnIntents(context.Context, int) ([]OrderEarnIntent, error) {
	var out []OrderEarnIntent
	for _, it := range r.intents {
		if it.AwardedAt == nil {
			out = append(out, *it)
		}
	}
	return out, nil
}
func (r *confirmEarnRepo) MarkEarnAwarded(_ context.Context, orderID int64) error {
	it, ok := r.intents[orderID]
	if !ok {
		return models.ErrNotFound
	}
	now := time.Now()
	it.AwardedAt = &now
	return nil
}

type orderMarkPaidOK struct {
	paidID int64
}

func (o *orderMarkPaidOK) MarkAsPaid(_ context.Context, _ pgx.Tx, orderID int64) error {
	o.paidID = orderID
	return nil
}
func (o *orderMarkPaidOK) GetStockLines(context.Context, int64) ([]inventory.StockLine, error) {
	return nil, nil
}

func newOrderConfirmFixture() (oid, uid int64, repo *confirmEarnRepo, orders *orderMarkPaidOK) {
	oid, uid = int64(88), int64(12)
	repo = &confirmEarnRepo{
		pt: &PaymentTransaction{
			ID: 4, OrderID: &oid, UserID: &uid, Amount: 50_000,
			Status: PaymentStatusPending, TransactionID: "gw-order-1", Currency: "IRT",
		},
	}
	return oid, uid, repo, &orderMarkPaidOK{}
}

func TestService_Confirm_AwardFailsOnceThenSucceeds(t *testing.T) {
	oid, uid, repo, orders := newOrderConfirmFixture()
	loy := &loyaltyStub{failN: 1, err: errors.New("transient award")}
	ref := &referralHookStub{}
	svc := NewService(repo, orders, nil, loy, ref, nil, nil)
	svc.earnBackoff = 0

	pt, err := svc.Confirm(context.Background(), ConfirmPaymentReq{TransactionID: "gw-order-1"})
	if err != nil {
		t.Fatalf("Confirm: %v", err)
	}
	if pt.Status != PaymentStatusSucceeded {
		t.Fatalf("status = %s; want succeeded", pt.Status)
	}
	if !repo.tx.Committed {
		t.Fatal("expected money TX commit")
	}
	if orders.paidID != oid {
		t.Fatalf("paid order = %d; want %d", orders.paidID, oid)
	}
	if loy.calls != 2 {
		t.Fatalf("AwardForOrder calls = %d; want 2 (fail then retry)", loy.calls)
	}
	if ref.calls != 1 || ref.userID != uid {
		t.Fatalf("OnPaidOrder = calls:%d user:%d; want 1 call for user %d", ref.calls, ref.userID, uid)
	}
	it := repo.intents[oid]
	if it == nil || it.AwardedAt == nil {
		t.Fatal("expected earn intent marked awarded after retry")
	}
}

func TestService_Confirm_AwardUltimatelyFails_PaymentStillPaid(t *testing.T) {
	oid, _, repo, orders := newOrderConfirmFixture()
	loy := &alwaysFailLoyalty{err: errors.New("loyalty down")}
	svc := NewService(repo, orders, nil, loy, nil, nil, nil)
	svc.earnBackoff = 0

	pt, err := svc.Confirm(context.Background(), ConfirmPaymentReq{TransactionID: "gw-order-1"})
	if err != nil {
		t.Fatalf("Confirm must succeed when loyalty fails: %v", err)
	}
	if pt.Status != PaymentStatusSucceeded {
		t.Fatalf("status = %s; want succeeded (payment must not roll back)", pt.Status)
	}
	if !repo.tx.Committed {
		t.Fatal("expected commit")
	}
	if loy.calls != defaultEarnRetryAttempts {
		t.Fatalf("AwardForOrder calls = %d; want %d retries", loy.calls, defaultEarnRetryAttempts)
	}
	it := repo.intents[oid]
	if it == nil {
		t.Fatal("expected earn intent persisted in Confirm TX")
	}
	if it.AwardedAt != nil {
		t.Fatal("must not mark awarded when AwardForOrder failed")
	}
}

type purchaseRecorderStub struct {
	calls   int
	userID  int64
	orderID int64
	err     error
}

func (p *purchaseRecorderStub) RecordPurchasesForOrder(_ context.Context, userID, orderID int64) error {
	p.calls++
	p.userID = userID
	p.orderID = orderID
	return p.err
}

func TestService_Confirm_RecordsPurchasesForOrder(t *testing.T) {
	oid, uid, repo, orders := newOrderConfirmFixture()
	recs := &purchaseRecorderStub{}
	svc := NewService(repo, orders, nil, nil, nil, nil, nil).WithPurchaseRecorder(recs)

	if _, err := svc.Confirm(context.Background(), ConfirmPaymentReq{TransactionID: "gw-order-1"}); err != nil {
		t.Fatalf("Confirm: %v", err)
	}
	if recs.calls != 1 || recs.userID != uid || recs.orderID != oid {
		t.Fatalf("recs = %+v; want 1 call user=%d order=%d", recs, uid, oid)
	}
}

func TestService_Confirm_PurchaseRecorderErrorDoesNotFailConfirm(t *testing.T) {
	_, _, repo, orders := newOrderConfirmFixture()
	recs := &purchaseRecorderStub{err: errors.New("recs down")}
	svc := NewService(repo, orders, nil, nil, nil, nil, nil).WithPurchaseRecorder(recs)

	pt, err := svc.Confirm(context.Background(), ConfirmPaymentReq{TransactionID: "gw-order-1"})
	if err != nil {
		t.Fatalf("Confirm must succeed when recs fail: %v", err)
	}
	if pt.Status != PaymentStatusSucceeded {
		t.Fatalf("status = %s", pt.Status)
	}
	if recs.calls != 1 {
		t.Fatalf("recs calls = %d, want 1", recs.calls)
	}
}

type paidReceiptStub struct {
	calls   int
	userID  int64
	orderID int64
	amount  float64
	err     error
}

func (p *paidReceiptStub) SendPaidOrderReceipt(_ context.Context, userID, orderID int64, amount float64) error {
	p.calls++
	p.userID = userID
	p.orderID = orderID
	p.amount = amount
	return p.err
}

func TestService_Confirm_SendsPaidOrderReceipt(t *testing.T) {
	oid, uid, repo, orders := newOrderConfirmFixture()
	receipt := &paidReceiptStub{}
	svc := NewService(repo, orders, nil, nil, nil, nil, nil).WithPaidOrderReceipt(receipt)

	if _, err := svc.Confirm(context.Background(), ConfirmPaymentReq{TransactionID: "gw-order-1"}); err != nil {
		t.Fatalf("Confirm: %v", err)
	}
	if receipt.calls != 1 || receipt.userID != uid || receipt.orderID != oid || receipt.amount != 50_000 {
		t.Fatalf("receipt = %+v; want 1 call user=%d order=%d amount=50000", receipt, uid, oid)
	}
}

func TestService_Confirm_ReceiptErrorDoesNotFailConfirm(t *testing.T) {
	_, _, repo, orders := newOrderConfirmFixture()
	receipt := &paidReceiptStub{err: errors.New("mail down")}
	svc := NewService(repo, orders, nil, nil, nil, nil, nil).WithPaidOrderReceipt(receipt)

	pt, err := svc.Confirm(context.Background(), ConfirmPaymentReq{TransactionID: "gw-order-1"})
	if err != nil {
		t.Fatalf("Confirm must succeed when receipt fails: %v", err)
	}
	if pt.Status != PaymentStatusSucceeded {
		t.Fatalf("status = %s", pt.Status)
	}
	if receipt.calls != 1 {
		t.Fatalf("receipt calls = %d, want 1", receipt.calls)
	}
}

func TestService_Confirm_WalletTopUpDoesNotSendReceipt(t *testing.T) {
	uid := int64(42)
	repo := &confirmEarnRepo{
		pt: &PaymentTransaction{
			ID: 9, UserID: &uid, OrderID: nil, Amount: 25_000,
			Status: PaymentStatusPending, TransactionID: "wtop-abc", Currency: "IRT",
		},
	}
	receipt := &paidReceiptStub{}
	walletStub := &walletCreditStub{}
	svc := NewService(repo, nil, nil, nil, nil, walletStub, nil).WithPaidOrderReceipt(receipt)
	if _, err := svc.Confirm(context.Background(), ConfirmPaymentReq{TransactionID: "wtop-abc"}); err != nil {
		t.Fatalf("Confirm: %v", err)
	}
	if receipt.calls != 0 {
		t.Fatalf("wallet top-up must not send an order receipt: calls=%d", receipt.calls)
	}
}

func TestService_Confirm_WalletTopUpDoesNotRecordPurchases(t *testing.T) {
	uid := int64(42)
	repo := &confirmEarnRepo{
		pt: &PaymentTransaction{
			ID: 9, UserID: &uid, OrderID: nil, Amount: 25_000,
			Status: PaymentStatusPending, TransactionID: "wtop-abc", Currency: "IRT",
		},
	}
	recs := &purchaseRecorderStub{}
	walletStub := &walletCreditStub{}
	svc := NewService(repo, nil, nil, nil, nil, walletStub, nil).WithPurchaseRecorder(recs)
	if _, err := svc.Confirm(context.Background(), ConfirmPaymentReq{TransactionID: "wtop-abc"}); err != nil {
		t.Fatalf("Confirm: %v", err)
	}
	if recs.calls != 0 {
		t.Fatalf("wallet top-up must not record purchase interactions: calls=%d", recs.calls)
	}
}

func TestService_ProcessPendingLoyaltyAwards_RetriesLeftover(t *testing.T) {
	oid, uid, repo, orders := newOrderConfirmFixture()
	loy := &alwaysFailLoyalty{err: errors.New("down")}
	svc := NewService(repo, orders, nil, loy, nil, nil, nil)
	svc.earnBackoff = 0

	if _, err := svc.Confirm(context.Background(), ConfirmPaymentReq{TransactionID: "gw-order-1"}); err != nil {
		t.Fatalf("Confirm: %v", err)
	}
	if repo.intents[oid].AwardedAt != nil {
		t.Fatal("intent should still be pending after failed award")
	}

	svc.loyalty = &loyaltyStub{}
	awarded, pending, err := svc.ProcessPendingLoyaltyAwards(context.Background())
	if err != nil {
		t.Fatalf("ProcessPendingLoyaltyAwards: %v", err)
	}
	if awarded != 1 || pending != 0 {
		t.Fatalf("awarded=%d pending=%d; want 1, 0", awarded, pending)
	}
	if repo.intents[oid].AwardedAt == nil {
		t.Fatal("leftover intent must be marked awarded on sweeper retry")
	}
	if repo.intents[oid].UserID != uid {
		t.Fatalf("intent user = %d; want %d", repo.intents[oid].UserID, uid)
	}
}

// deductFailInventory fails the in-transaction stock drain. Only the one method
// Confirm calls is implemented; anything else is a test bug and panics.
type deductFailInventory struct {
	inventory.Service
	err error
}

func (i *deductFailInventory) DeductForOrderTx(context.Context, pgx.Tx, int64, []inventory.StockLine) error {
	return i.err
}

// Confirm's contract: "If money/stock fails the whole thing rolls back — the
// order never shows as paid without a confirmed payment record." MarkAsPaid runs
// BEFORE the stock drain, so the only thing standing between a stock failure and
// a paid-but-unstocked order is the rollback. Pin it.
func TestConfirmRollsBackSoAnOrderNeverShowsPaidWithoutConfirmedMoney(t *testing.T) {
	_, _, repo, orders := newOrderConfirmFixture()
	inv := &deductFailInventory{err: errors.New("insufficient committed stock")}
	svc := NewService(repo, orders, inv, nil, nil, nil, nil)

	if _, err := svc.Confirm(context.Background(), ConfirmPaymentReq{TransactionID: "gw-order-1"}); err == nil {
		t.Fatal("Confirm returned nil after the stock drain failed")
	}
	if repo.tx.Committed {
		t.Error("the confirm transaction committed after a failed stock drain; the order is paid with stock it never took")
	}
	if !repo.tx.RolledBack {
		t.Error("the confirm transaction was neither committed nor rolled back — the connection leaks and MarkAsPaid may still land")
	}
	if len(repo.intents) != 0 {
		t.Errorf("an earn intent was written on a rolled-back confirm: %+v", repo.intents)
	}
}
