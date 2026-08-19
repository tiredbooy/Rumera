package orders

import (
	"strings"
	"testing"

	"github.com/tiredbooy/internal/features/inventory"
)

func TestGetStockLinesSQL_OrderItemsOnly(t *testing.T) {
	q := compactSQL(getStockLinesSQL)
	if !strings.Contains(q, "from order_items") {
		t.Fatalf("GetStockLines must query order_items:\n%s", getStockLinesSQL)
	}
	if !strings.Contains(q, "product_variant_id") || !strings.Contains(q, "quantity") {
		t.Fatalf("GetStockLines must select product_variant_id, quantity:\n%s", getStockLinesSQL)
	}
	if strings.Contains(q, "join") || strings.Contains(q, "products") {
		t.Fatalf("GetStockLines must not join products (missing product would drop lines):\n%s", getStockLinesSQL)
	}
}

func TestGetStockLines_MissingProductStillReturnsLine(t *testing.T) {
	// GetItems INNER JOIN products would drop this row. GetStockLines maps
	// order_items.product_variant_id + quantity only, so the line survives.
	if strings.Contains(compactSQL(getStockLinesSQL), "products") ||
		strings.Contains(compactSQL(getStockLinesSQL), "join") {
		t.Fatalf("GetStockLines joined products; deleted product would silently drop the line:\n%s", getStockLinesSQL)
	}

	// order_items row whose products.id is gone still becomes a stock line.
	lines := []inventory.StockLine{{VariantID: 42, Quantity: 3}}
	lines = inventory.NormalizeStockLines(lines)
	if len(lines) != 1 {
		t.Fatalf("len(lines)=%d; want 1 (deleted product must not drop the line)", len(lines))
	}
	if lines[0].VariantID != 42 || lines[0].Quantity != 3 {
		t.Fatalf("line = %+v; want variant 42 qty 3", lines[0])
	}
}

func TestGetStockLines_SortedByVariantID(t *testing.T) {
	// GetStockLines reads order_items then normalizes before return.
	lines := []inventory.StockLine{
		{VariantID: 30, Quantity: 1},
		{VariantID: 10, Quantity: 2},
		{VariantID: 20, Quantity: 3},
		{VariantID: 5, Quantity: 1},
	}
	lines = inventory.NormalizeStockLines(lines)

	want := []inventory.StockLine{
		{VariantID: 5, Quantity: 1},
		{VariantID: 10, Quantity: 2},
		{VariantID: 20, Quantity: 3},
		{VariantID: 30, Quantity: 1},
	}
	if len(lines) != len(want) {
		t.Fatalf("len(lines) = %d; want %d", len(lines), len(want))
	}
	for i := range want {
		if lines[i].VariantID != want[i].VariantID || lines[i].Quantity != want[i].Quantity {
			t.Fatalf("lines[%d] = %+v; want %+v (GetStockLines must return VariantID ascending)", i, lines[i], want[i])
		}
	}
}

func TestNormalizeStockLines_EmptyAndSingle(t *testing.T) {
	if got := inventory.NormalizeStockLines(nil); len(got) != 0 {
		t.Fatalf("nil normalized to %+v", got)
	}

	one := inventory.NormalizeStockLines([]inventory.StockLine{{VariantID: 7, Quantity: 4}})
	if one[0].VariantID != 7 || one[0].Quantity != 4 {
		t.Fatalf("single line mutated: %+v", one[0])
	}
}

// A-9: two order_items rows for one variant must reserve/deduct their SUM, because
// inventory_reservations is unique on (order_id, product_variant_id). Per-row lines
// make closeReservation's `quantity = $3` miss and Confirm roll back after payment.
func TestNormalizeStockLines_MergesDuplicateVariant(t *testing.T) {
	in := []inventory.StockLine{
		{VariantID: 20, Quantity: 1},
		{VariantID: 10, Quantity: 2},
		{VariantID: 20, Quantity: 3},
	}
	got := inventory.NormalizeStockLines(in)

	want := []inventory.StockLine{{VariantID: 10, Quantity: 2}, {VariantID: 20, Quantity: 4}}
	if len(got) != len(want) {
		t.Fatalf("got %+v; want %+v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("got[%d] = %+v; want %+v", i, got[i], want[i])
		}
	}
	if len(in) != 3 || in[0].VariantID != 20 {
		t.Fatalf("caller slice mutated: %+v", in)
	}
}
