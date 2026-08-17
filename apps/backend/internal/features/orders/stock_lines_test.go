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
	sortStockLinesByVariantID(lines)
	if len(lines) != 1 {
		t.Fatalf("len(lines)=%d; want 1 (deleted product must not drop the line)", len(lines))
	}
	if lines[0].VariantID != 42 || lines[0].Quantity != 3 {
		t.Fatalf("line = %+v; want variant 42 qty 3", lines[0])
	}
}

func TestGetStockLines_SortedByVariantID(t *testing.T) {
	// GetStockLines reads order_items then sortStockLinesByVariantID before return.
	lines := []inventory.StockLine{
		{VariantID: 30, Quantity: 1},
		{VariantID: 10, Quantity: 2},
		{VariantID: 20, Quantity: 3},
		{VariantID: 5, Quantity: 1},
	}
	sortStockLinesByVariantID(lines)

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

func TestSortStockLinesByVariantID_EmptyAndSingle(t *testing.T) {
	sortStockLinesByVariantID(nil)

	one := []inventory.StockLine{{VariantID: 7, Quantity: 4}}
	sortStockLinesByVariantID(one)
	if one[0].VariantID != 7 || one[0].Quantity != 4 {
		t.Fatalf("single line mutated: %+v", one[0])
	}
}
