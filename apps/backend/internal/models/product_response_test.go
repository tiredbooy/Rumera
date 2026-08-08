package models

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestProductListItemPurchasableVariantIDJSON(t *testing.T) {
	item := ProductListItem{ID: 1, Title: "Bottle"}

	withoutVariant, err := json.Marshal(item)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(withoutVariant), "purchasable_variant_id") {
		t.Fatalf("nil variant id must be omitted: %s", withoutVariant)
	}
	if !strings.Contains(string(withoutVariant), `"available_stock":0`) {
		t.Fatalf("aggregate stock must always be serialized: %s", withoutVariant)
	}

	variantID := int64(42)
	item.PurchasableVariantID = &variantID
	item.AvailableStock = 2
	withVariant, err := json.Marshal(item)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(withVariant), `"purchasable_variant_id":42`) {
		t.Fatalf("variant id must be serialized: %s", withVariant)
	}
	if !strings.Contains(string(withVariant), `"available_stock":2`) {
		t.Fatalf("aggregate stock must be serialized: %s", withVariant)
	}

	item.Tags = []TagResponse{{ID: 7, Title: "Gift"}}
	withTags, err := json.Marshal(item)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(withTags), `"tags":[{"id":7,"title":"Gift"}]`) {
		t.Fatalf("product-list tags must be serialized: %s", withTags)
	}
}

func TestVariantResponseAvailableStockJSON(t *testing.T) {
	variant := VariantResponse{ID: 7, Price: 100}

	withoutStock, err := json.Marshal(variant)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(withoutStock), "available_stock") {
		t.Fatalf("generic variant stock must be omitted: %s", withoutStock)
	}

	stock := 0
	variant.AvailableStock = &stock
	withStock, err := json.Marshal(variant)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(withStock), `"available_stock":0`) {
		t.Fatalf("hydrated zero stock must be serialized: %s", withStock)
	}
}
