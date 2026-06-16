//go:build integration

package integration

import (
	"context"
	"testing"

	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/internal/repositories"
	"github.com/tiredbooy/internal/services"
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

	inv := services.NewInventoryService(
		repositories.NewInventoryRepository(testPool),
		repositories.NewMovementRepository(testPool),
	)
	pay := services.NewPaymentService(
		repositories.NewPaymentTransactionRepository(testPool),
		repositories.NewOrderRepository(testPool),
		inv, nil, nil,
	)

	pt, err := pay.Confirm(ctx, models.ConfirmPaymentReq{TransactionID: "txn_confirm_atomic"})
	if err != nil {
		t.Fatalf("Confirm: %v", err)
	}
	if pt.OrderID == nil || *pt.OrderID != oid {
		t.Fatalf("confirmed payment order = %v; want %d", pt.OrderID, oid)
	}

	if got := committedStock(t, vid); got != 8 {
		t.Fatalf("committed_stock = %d; want 8 (10 - 2 deducted)", got)
	}
	if got := orderStatus(t, oid); got != "paid" {
		t.Fatalf("order status = %q; want paid", got)
	}

	// Replay: a duplicate callback for an already-settled transaction must NOT
	// confirm again or deduct a second time.
	if _, err := pay.Confirm(ctx, models.ConfirmPaymentReq{TransactionID: "txn_confirm_atomic"}); err == nil {
		t.Fatal("second Confirm should fail (transaction no longer pending)")
	}
	if got := committedStock(t, vid); got != 8 {
		t.Fatalf("committed_stock after replay = %d; want 8 (no double deduction)", got)
	}
}
