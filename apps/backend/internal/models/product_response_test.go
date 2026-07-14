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

	variantID := int64(42)
	item.PurchasableVariantID = &variantID
	withVariant, err := json.Marshal(item)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(withVariant), `"purchasable_variant_id":42`) {
		t.Fatalf("variant id must be serialized: %s", withVariant)
	}
}
