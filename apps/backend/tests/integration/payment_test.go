//go:build integration

package integration

import (
	"context"
	"errors"
	"testing"

	"github.com/tiredbooy/internal/features/inventory"
	"github.com/tiredbooy/internal/features/orders"
	"github.com/tiredbooy/internal/features/payments"
	"github.com/tiredbooy/internal/models"
)

// TestPaymentConfirm_DeductsStockAtomically proves the Epic-E fix: confirming a
// payment now marks the payment succeeded, marks the order paid, AND drains the
// committed stock in a single transaction. Previously the deduct ran in a
// separate tx in the webhook handler with its error discarded, so a failed
// deduct left the order paid but stock never released.
func TestPaymentConfirm_DeductsStockAtomically(t *testing.T) {
	requireDB(t)
	resetTables(t, "users", "products", "coupons")
	ctx := context.Background()

	uid := seedUser(t)
	pid := seedProduct(t)
	vid := seedVariant(t, pid)
	seedInventory(t, vid, 100, 10) // 10 units committed (reserved at checkout)
	oid := seedOrder(t, uid)
	seedOrderItem(t, oid, pid, vid, 2) // this order holds 2 of them
	seedPaymentTxn(t, oid, uid, "txn_confirm_atomic")

	inv := inventory.NewService(
		inventory.NewRepository(testPool),
		inventory.NewMovementRepository(testPool),
	)
	pay := payments.NewService(
		payments.NewRepository(testPool),
		orders.NewRepository(testPool),
		inv, nil, nil, nil, nil,
	)

	pt, err := pay.Confirm(ctx, payments.ConfirmPaymentReq{TransactionID: "txn_confirm_atomic"})
	if err != nil {
		t.Fatalf("Confirm: %v", err)
	}
	if pt.OrderID == nil || *pt.OrderID != oid {
		t.Fatalf("confirmed payment order = %v; want %d", pt.OrderID, oid)
	}

	if got := committedStock(t, vid); got != 8 {
		t.Fatalf("committed_stock = %d; want 8 (10 - 2 deducted)", got)
	}
	if got := physicalStock(t, vid); got != 98 {
		t.Fatalf("stock_on_hand = %d; want 98 (100 - 2 sold)", got)
	}
	if got := orderStatus(t, oid); got != "paid" {
		t.Fatalf("order status = %q; want paid", got)
	}

	// Replay: a duplicate callback for an already-settled transaction must NOT
	// confirm again or deduct a second time.
	if _, err := pay.Confirm(ctx, payments.ConfirmPaymentReq{TransactionID: "txn_confirm_atomic"}); err == nil {
		t.Fatal("second Confirm should fail (transaction no longer pending)")
	}
	if got := committedStock(t, vid); got != 8 {
		t.Fatalf("committed_stock after replay = %d; want 8 (no double deduction)", got)
	}
	if got := physicalStock(t, vid); got != 98 {
		t.Fatalf("stock_on_hand after replay = %d; want 98 (no double deduction)", got)
	}
}

// TestPaymentTransactionID_Unique enforces PH-011d: gateway transaction_id is a
// unique natural key. A second insert with the same id must conflict.
func TestPaymentTransactionID_Unique(t *testing.T) {
	requireDB(t)
	resetTables(t, "users", "products", "coupons")
	ctx := context.Background()

	uid := seedUser(t)
	oid1 := seedOrder(t, uid)
	oid2 := seedOrder(t, uid)
	seedPaymentTxn(t, oid1, uid, "txn_unique_key")

	repo := payments.NewRepository(testPool)
	tx, err := repo.BeginTx(ctx)
	if err != nil {
		t.Fatalf("BeginTx: %v", err)
	}
	defer tx.Rollback(ctx)

	_, err = repo.Create(ctx, tx, payments.CreatePaymentTransactionReq{
		OrderID:       &oid2,
		UserID:        uid,
		Amount:        1000,
		Currency:      "IRT",
		PaymentMethod: models.PaymentMethodGateway,
		TransactionID: "txn_unique_key",
	})
	if err == nil {
		_ = tx.Commit(ctx)
		t.Fatal("Create with duplicate transaction_id should fail unique constraint")
	}
	if !errors.Is(err, models.ErrConflict) {
		t.Fatalf("Create err = %v; want models.ErrConflict (unique transaction_id)", err)
	}
}

// TestPaymentConfirm_ReplayIsIdempotentAtDomain documents that Confirm is
// pending-only (second call fails) while the UNIQUE index prevents a second
// payment_transactions row from ever existing for the same gateway id.
func TestPaymentConfirm_ReplayIsIdempotentAtDomain(t *testing.T) {
	requireDB(t)
	resetTables(t, "users", "products", "coupons")
	ctx := context.Background()

	uid := seedUser(t)
	pid := seedProduct(t)
	vid := seedVariant(t, pid)
	seedInventory(t, vid, 50, 5)
	oid := seedOrder(t, uid)
	seedOrderItem(t, oid, pid, vid, 1)
	seedPaymentTxn(t, oid, uid, "txn_domain_replay")

	pay := payments.NewService(
		payments.NewRepository(testPool),
		orders.NewRepository(testPool),
		inventory.NewService(
			inventory.NewRepository(testPool),
			inventory.NewMovementRepository(testPool),
		),
		nil, nil, nil, nil,
	)

	if _, err := pay.Confirm(ctx, payments.ConfirmPaymentReq{TransactionID: "txn_domain_replay"}); err != nil {
		t.Fatalf("first Confirm: %v", err)
	}
	if _, err := pay.Confirm(ctx, payments.ConfirmPaymentReq{TransactionID: "txn_domain_replay"}); err == nil {
		t.Fatal("second Confirm must fail (no longer pending)")
	}
	// Still a single row for this gateway id.
	var n int
	if err := testPool.QueryRow(ctx,
		`SELECT COUNT(*) FROM payment_transactions WHERE transaction_id = $1`,
		"txn_domain_replay").Scan(&n); err != nil {
		t.Fatalf("count: %v", err)
	}
	if n != 1 {
		t.Fatalf("rows for transaction_id = %d; want 1 (UNIQUE)", n)
	}
}
