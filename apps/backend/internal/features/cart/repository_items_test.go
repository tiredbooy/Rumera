package cart

import (
	"encoding/json"
	"os"
	"path/filepath"
	"reflect"
	"runtime"
	"strings"
	"testing"

	"github.com/tiredbooy/internal/models"
)

func TestVariantOptionsQueryJoinsOptionTables(t *testing.T) {
	for _, want := range []string{
		"product_variants_options",
		"option_values",
		"option_types",
		"ANY($1)",
	} {
		if !strings.Contains(variantOptionsQuery, want) {
			t.Fatalf("variantOptionsQuery missing %q", want)
		}
	}
	if strings.Contains(variantOptionsQuery, "p.is_active") ||
		strings.Contains(variantOptionsQuery, "pv.is_active") {
		t.Fatal("options query must not re-filter is_active; GetItems already does")
	}
}

func TestGetItemsKeepsActiveFiltersAndHydratesOptions(t *testing.T) {
	_, thisFile, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("runtime.Caller failed")
	}
	src, err := os.ReadFile(filepath.Join(filepath.Dir(thisFile), "repository.go"))
	if err != nil {
		t.Fatalf("read repository.go: %v", err)
	}
	body := string(src)
	for _, want := range []string{
		"pv.is_active = true",
		"p.is_active  = true",
		"hydrateItemOptions",
		"loadVariantOptions",
		"assignVariantOptions",
		"variantOptionsQuery",
	} {
		if !strings.Contains(body, want) {
			t.Fatalf("repository.go missing %q", want)
		}
	}
}

func TestCollectVariantIDs(t *testing.T) {
	t.Run("unique in first-seen order", func(t *testing.T) {
		got := collectVariantIDs([]CartItemResponse{
			{VariantID: 3},
			{VariantID: 1},
			{VariantID: 3},
			{VariantID: 0},
			{VariantID: 2},
		})
		want := []int64{3, 1, 2}
		if !reflect.DeepEqual(got, want) {
			t.Fatalf("collectVariantIDs = %v; want %v", got, want)
		}
	})
	t.Run("empty items", func(t *testing.T) {
		if got := collectVariantIDs(nil); got != nil {
			t.Fatalf("nil items = %v; want nil", got)
		}
		if got := collectVariantIDs([]CartItemResponse{}); got != nil {
			t.Fatalf("empty items = %v; want nil", got)
		}
	})
}

func TestAssignVariantOptions(t *testing.T) {
	colorRed := models.OptionValueResponse{
		ID: 1, OptionTypeID: 10, OptionTypeTitle: "color", OptionType: "Color", Value: "Red",
	}
	sizeM := models.OptionValueResponse{
		ID: 2, OptionTypeID: 11, OptionTypeTitle: "size", OptionType: "Size", Value: "M",
	}

	tests := []struct {
		name    string
		items   []CartItemResponse
		options map[int64][]models.OptionValueResponse
		want    [][]models.OptionValueResponse
	}{
		{
			name:  "maps options by variant id",
			items: []CartItemResponse{{VariantID: 7}, {VariantID: 8}},
			options: map[int64][]models.OptionValueResponse{
				7: {colorRed},
				8: {sizeM},
			},
			want: [][]models.OptionValueResponse{{colorRed}, {sizeM}},
		},
		{
			name:  "missing variant leaves options empty",
			items: []CartItemResponse{{VariantID: 7}, {VariantID: 9}},
			options: map[int64][]models.OptionValueResponse{
				7: {colorRed},
			},
			want: [][]models.OptionValueResponse{{colorRed}, nil},
		},
		{
			name:  "duplicate variant ids share the same options",
			items: []CartItemResponse{{ID: 1, VariantID: 7}, {ID: 2, VariantID: 7}},
			options: map[int64][]models.OptionValueResponse{
				7: {colorRed, sizeM},
			},
			want: [][]models.OptionValueResponse{{colorRed, sizeM}, {colorRed, sizeM}},
		},
		{
			name:    "empty map is a no-op",
			items:   []CartItemResponse{{VariantID: 7}},
			options: nil,
			want:    [][]models.OptionValueResponse{nil},
		},
		{
			name:    "empty items is a no-op",
			items:   nil,
			options: map[int64][]models.OptionValueResponse{7: {colorRed}},
			want:    nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assignVariantOptions(tt.items, tt.options)
			if tt.want == nil {
				if len(tt.items) != 0 {
					t.Fatalf("items = %#v; want empty", tt.items)
				}
				return
			}
			if len(tt.items) != len(tt.want) {
				t.Fatalf("len(items)=%d want %d", len(tt.items), len(tt.want))
			}
			for i := range tt.items {
				if !reflect.DeepEqual(tt.items[i].Options, tt.want[i]) {
					t.Fatalf("item[%d].Options = %#v; want %#v", i, tt.items[i].Options, tt.want[i])
				}
			}
		})
	}
}

// U-3: a sold-out line must be distinguishable in the cart, so GetItems has to
// project the same availability the reserve path enforces at checkout.
func TestGetItemsProjectsAvailableStock(t *testing.T) {
	_, thisFile, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("runtime.Caller failed")
	}
	src, err := os.ReadFile(filepath.Join(filepath.Dir(thisFile), "repository.go"))
	if err != nil {
		t.Fatalf("read repository.go: %v", err)
	}
	body := string(src)
	for _, want := range []string{
		"LEFT  JOIN inventory        i  ON i.product_variant_id = pv.id",
		"COALESCE(i.stock_on_hand, 0) - COALESCE(i.committed_stock, 0)",
		"AS available_stock",
		"&item.AvailableStock,",
	} {
		if !strings.Contains(body, want) {
			t.Fatalf("GetItems no longer carries stock on the cart projection: missing %q", want)
		}
	}
	// Clamped at the DB boundary so a drifted negative never reaches the client.
	if !strings.Contains(body, "GREATEST(") {
		t.Fatal("available_stock must be clamped with GREATEST(..., 0)")
	}
}

func TestCartItemResponseSerializesAvailableStock(t *testing.T) {
	// available_stock is a plain int (never omitempty): a sold-out line must
	// serialize as 0, not vanish and read as "unknown" on the client.
	payload, err := json.Marshal(CartItemResponse{ID: 1, Quantity: 2})
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	if !strings.Contains(string(payload), `"available_stock":0`) {
		t.Fatalf("payload = %s; want available_stock:0", payload)
	}
}
