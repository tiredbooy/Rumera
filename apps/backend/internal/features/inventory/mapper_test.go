package inventory

import (
	"encoding/json"
	"testing"
)

func TestInventoryResponseJSONContract(t *testing.T) {
	w := 1.25
	response := ToInventoryResponse(&Inventory{
		ID:               7,
		ProductVariantID: 312,
		ProductID:        31,
		ProductTitle:     "Test Bottle",
		UnitPrice:        "1250000.50",
		WeightKg:         &w,
		StockOnHand:      40,
		CommittedStock:   6,
		ReorderPoint:     10,
		ReorderQuantity:  50,
	})

	payload, err := json.Marshal(response)
	if err != nil {
		t.Fatalf("marshal inventory response: %v", err)
	}

	var got map[string]any
	if err := json.Unmarshal(payload, &got); err != nil {
		t.Fatalf("unmarshal inventory response: %v", err)
	}

	if got["available_stock"] != float64(34) {
		t.Fatalf("available_stock = %#v, want 34", got["available_stock"])
	}
	if got["unit_price"] != "1250000.50" {
		t.Fatalf("unit_price = %#v, want exact decimal string", got["unit_price"])
	}
	if got["product_title"] != "Test Bottle" {
		t.Fatalf("product_title = %#v, want joined product title", got["product_title"])
	}
	if got["weight"] != 1.25 {
		t.Fatalf("weight = %#v, want 1.25", got["weight"])
	}
	if got["missing_weight"] != false {
		t.Fatalf("missing_weight = %#v, want false when weight set", got["missing_weight"])
	}
	if _, exists := got["sku"]; exists {
		t.Fatal("sku must be omitted when unset")
	}
	if _, exists := got["category_title"]; exists {
		t.Fatal("category_title must be omitted when unset")
	}
	if _, exists := got["last_restock_at"]; exists {
		t.Fatal("last_restock_at must be omitted when unset")
	}
}

func TestInventoryResponseMissingWeight(t *testing.T) {
	// Unset catalogue weight.
	got := ToInventoryResponse(&Inventory{ID: 1, ProductTitle: "x", UnitPrice: "1"})
	if !got.MissingWeight || got.Weight != nil {
		t.Fatalf("unset: MissingWeight=%v Weight=%v", got.MissingWeight, got.Weight)
	}
	// Non-positive treated as missing (not shippable).
	zero := 0.0
	got = ToInventoryResponse(&Inventory{ID: 1, ProductTitle: "x", UnitPrice: "1", WeightKg: &zero})
	if !got.MissingWeight || got.Weight != nil {
		t.Fatalf("zero: MissingWeight=%v Weight=%v", got.MissingWeight, got.Weight)
	}
	neg := -0.5
	got = ToInventoryResponse(&Inventory{ID: 1, ProductTitle: "x", UnitPrice: "1", WeightKg: &neg})
	if !got.MissingWeight || got.Weight != nil {
		t.Fatalf("neg: MissingWeight=%v Weight=%v", got.MissingWeight, got.Weight)
	}
}

func TestInventoryMovementResponseOmitsUnsetOptionalFields(t *testing.T) {
	payload, err := json.Marshal(ToMovementResponse(&InventoryMovement{}))
	if err != nil {
		t.Fatalf("marshal inventory movement: %v", err)
	}

	var got map[string]any
	if err := json.Unmarshal(payload, &got); err != nil {
		t.Fatalf("unmarshal inventory movement: %v", err)
	}
	if _, exists := got["reference_order_id"]; exists {
		t.Fatal("reference_order_id must be omitted when unset")
	}
	if _, exists := got["note"]; exists {
		t.Fatal("note must be omitted when unset")
	}
}
