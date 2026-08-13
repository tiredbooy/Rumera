package analytics

import (
	"encoding/json"
	"testing"

	"github.com/shopspring/decimal"
)

func TestAnalyticsDecimalsMarshalAsStrings(t *testing.T) {
	summary := RevenueStatsSummary{
		TotalOrders:       4,
		TotalGrossRevenue: decimal.RequireFromString("12.34"),
		TotalNetRevenue:   decimal.RequireFromString("10.00"),
		TotalRefunds:      decimal.RequireFromString("1.00"),
		TotalDiscounts:    decimal.RequireFromString("1.34"),
		AvgOrderValue:     decimal.RequireFromString("3.085"),
		AvgConversionRate: decimal.RequireFromString("0.125"),
		UniqueCustomers:   3,
	}

	assertJSONStringField(t, summary, "total_gross_revenue", "12.34")
	assertJSONStringField(t, summary, "avg_conversion_rate", "0.125")
}

func TestProductAnalyticsContractUsesCatalogIDAndNullableDecimal(t *testing.T) {
	const productID int64 = 42
	stats := DailyProductStats{ProductID: productID}

	raw, err := json.Marshal(stats)
	if err != nil {
		t.Fatalf("marshal product stats: %v", err)
	}

	var got map[string]any
	if err := json.Unmarshal(raw, &got); err != nil {
		t.Fatalf("unmarshal product stats: %v", err)
	}
	// JSON numbers decode as float64 in map[string]any.
	if got["product_id"] != float64(productID) {
		t.Fatalf("product_id = %v, want %d", got["product_id"], productID)
	}
	if got["avg_rating"] != nil {
		t.Fatalf("avg_rating = %v, want null", got["avg_rating"])
	}
}

func TestEventBreakdownMarshalsAsRecord(t *testing.T) {
	breakdown := EventBreakdown{"product_view": 12, "purchase": 3}

	raw, err := json.Marshal(breakdown)
	if err != nil {
		t.Fatalf("marshal event breakdown: %v", err)
	}

	var got map[string]int64
	if err := json.Unmarshal(raw, &got); err != nil {
		t.Fatalf("unmarshal event breakdown: %v", err)
	}
	if got["product_view"] != 12 || got["purchase"] != 3 {
		t.Fatalf("breakdown = %#v, want record counts", got)
	}
}

func assertJSONStringField(t *testing.T, value any, field, want string) {
	t.Helper()
	raw, err := json.Marshal(value)
	if err != nil {
		t.Fatalf("marshal analytics response: %v", err)
	}

	var got map[string]any
	if err := json.Unmarshal(raw, &got); err != nil {
		t.Fatalf("unmarshal analytics response: %v", err)
	}
	if got[field] != want {
		t.Fatalf("%s = %#v, want string %q", field, got[field], want)
	}
}
