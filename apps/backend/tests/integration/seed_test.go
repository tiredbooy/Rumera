//go:build integration

package integration

import (
	"context"
	"testing"
)

// Minimal seed helpers — each inserts the smallest valid row and returns its id.
// Tests truncate (CASCADE) first, so ids restart and emails/codes don't collide.

func seedUser(t *testing.T) int64 {
	t.Helper()
	var id int64
	err := testPool.QueryRow(context.Background(),
		`INSERT INTO users (user_id, email) VALUES (gen_random_uuid(), 'buyer@test.local') RETURNING id`).Scan(&id)
	if err != nil {
		t.Fatalf("seed user: %v", err)
	}
	return id
}

func seedProduct(t *testing.T) int64 {
	t.Helper()
	var id int64
	if err := testPool.QueryRow(context.Background(),
		`INSERT INTO products (title) VALUES ('Test Bottle') RETURNING id`).Scan(&id); err != nil {
		t.Fatalf("seed product: %v", err)
	}
	return id
}

func seedVariant(t *testing.T, productID int64) int64 {
	t.Helper()
	var id int64
	if err := testPool.QueryRow(context.Background(),
		`INSERT INTO product_variants (product_id) VALUES ($1) RETURNING id`, productID).Scan(&id); err != nil {
		t.Fatalf("seed variant: %v", err)
	}
	return id
}

func seedInventory(t *testing.T, variantID int64, onHand, committed int) {
	t.Helper()
	// Upsert: variants created through the service already own a zeroed
	// inventory row, so seeding stock has to overwrite rather than insert.
	if _, err := testPool.Exec(context.Background(),
		`INSERT INTO inventory (product_variant_id, stock_on_hand, committed_stock) VALUES ($1, $2, $3)
		 ON CONFLICT (product_variant_id)
		 DO UPDATE SET stock_on_hand = EXCLUDED.stock_on_hand, committed_stock = EXCLUDED.committed_stock`,
		variantID, onHand, committed); err != nil {
		t.Fatalf("seed inventory: %v", err)
	}
}

func seedOrder(t *testing.T, userID int64) int64 {
	t.Helper()
	var id int64
	// total_amount is a GENERATED column — don't insert it; it computes from the
	// money columns (subtotal/discount/shipping/tax, which default to 0).
	if err := testPool.QueryRow(context.Background(),
		`INSERT INTO orders (user_id, payment_method, subtotal, status)
		 VALUES ($1, 'card', 50, 'pending') RETURNING id`, userID).Scan(&id); err != nil {
		t.Fatalf("seed order: %v", err)
	}
	return id
}

func seedOrderItem(t *testing.T, orderID, productID, variantID int64, qty int) {
	t.Helper()
	if _, err := testPool.Exec(context.Background(),
		`INSERT INTO order_items (order_id, product_id, product_variant_id, quantity, unit_price)
		 VALUES ($1, $2, $3, $4, 25)`, orderID, productID, variantID, qty); err != nil {
		t.Fatalf("seed order item: %v", err)
	}
	// PR-020b: a pending order's committed stock is bound to an active
	// inventory_reservations row (written by ReserveForOrderTx at checkout,
	// backfilled for in-flight orders by 20260816190000). Release/Deduct are
	// fail-closed without it, so the seeded line needs the same identity.
	if _, err := testPool.Exec(context.Background(),
		`INSERT INTO inventory_reservations (order_id, product_variant_id, quantity, status)
		 VALUES ($1, $2, $3, 'active')
		 ON CONFLICT (order_id, product_variant_id)
		 DO UPDATE SET quantity = inventory_reservations.quantity + EXCLUDED.quantity,
		               status   = 'active'`,
		orderID, variantID, qty); err != nil {
		t.Fatalf("seed order reservation: %v", err)
	}
}

func seedPaymentTxn(t *testing.T, orderID, userID int64, txnID string) {
	t.Helper()
	if _, err := testPool.Exec(context.Background(),
		`INSERT INTO payment_transactions (order_id, user_id, amount, currency, payment_method, transaction_id, status)
		 VALUES ($1, $2, 50, 'USD', 'card', $3, 'pending')`, orderID, userID, txnID); err != nil {
		t.Fatalf("seed payment txn: %v", err)
	}
}

func seedCoupon(t *testing.T, code string, maxUses int) int64 {
	t.Helper()
	var id int64
	if err := testPool.QueryRow(context.Background(),
		`INSERT INTO coupons (code, discount_type, discount_value, max_uses, is_active)
		 VALUES ($1, 'percentage', 10, $2, true) RETURNING id`, code, maxUses).Scan(&id); err != nil {
		t.Fatalf("seed coupon: %v", err)
	}
	return id
}

func committedStock(t *testing.T, variantID int64) int {
	t.Helper()
	var n int
	if err := testPool.QueryRow(context.Background(),
		`SELECT committed_stock FROM inventory WHERE product_variant_id = $1`, variantID).Scan(&n); err != nil {
		t.Fatalf("read committed_stock: %v", err)
	}
	return n
}

func physicalStock(t *testing.T, variantID int64) int {
	t.Helper()
	var n int
	if err := testPool.QueryRow(context.Background(),
		`SELECT stock_on_hand FROM inventory WHERE product_variant_id = $1`, variantID).Scan(&n); err != nil {
		t.Fatalf("read stock_on_hand: %v", err)
	}
	return n
}

// assertInventoryRow fails unless variantID has an inventory row with the given counters.
func assertInventoryRow(t *testing.T, variantID int64, wantOnHand, wantCommitted int) {
	t.Helper()
	var onHand, committed int
	err := testPool.QueryRow(context.Background(),
		`SELECT stock_on_hand, committed_stock FROM inventory WHERE product_variant_id = $1`,
		variantID,
	).Scan(&onHand, &committed)
	if err != nil {
		t.Fatalf("inventory for variant %d: %v", variantID, err)
	}
	if onHand != wantOnHand || committed != wantCommitted {
		t.Fatalf("inventory for variant %d = %d/%d; want %d/%d",
			variantID, onHand, committed, wantOnHand, wantCommitted)
	}
}

func orderStatus(t *testing.T, orderID int64) string {
	t.Helper()
	var s string
	if err := testPool.QueryRow(context.Background(),
		`SELECT status FROM orders WHERE id = $1`, orderID).Scan(&s); err != nil {
		t.Fatalf("read order status: %v", err)
	}
	return s
}
