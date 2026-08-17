package alerts

import (
	"encoding/json"
	"testing"
	"time"
)

func TestProductAlertResponseIncludesNullableFields(t *testing.T) {
	response := ProductAlertResponse{
		ID:               1,
		ProductVariantID: 2,
		AlertType:        AlertPriceDrop,
		CreatedAt:        time.Unix(0, 0).UTC(),
	}

	payload, err := json.Marshal(response)
	if err != nil {
		t.Fatalf("marshal product alert response: %v", err)
	}

	var body map[string]any
	if err := json.Unmarshal(payload, &body); err != nil {
		t.Fatalf("unmarshal product alert response: %v", err)
	}
	if value, ok := body["target_price"]; !ok || value != nil {
		t.Fatalf("target_price = %#v, present = %v; want explicit null", value, ok)
	}
	if value, ok := body["notified_at"]; !ok || value != nil {
		t.Fatalf("notified_at = %#v, present = %v; want explicit null", value, ok)
	}
	if value, ok := body["product_title"]; !ok || value != nil {
		t.Fatalf("product_title = %#v, present = %v; want explicit null", value, ok)
	}
	if value, ok := body["product_slug"]; !ok || value != nil {
		t.Fatalf("product_slug = %#v, present = %v; want explicit null", value, ok)
	}
	if value, ok := body["current_price"]; !ok || value != nil {
		t.Fatalf("current_price = %#v, present = %v; want explicit null", value, ok)
	}
}

func TestProductAlertResponseIncludesListEnrichment(t *testing.T) {
	title := "بطری شیراز"
	slug := "shiraz-bottle"
	price := 450000.0
	response := ProductAlertResponse{
		ID:               1,
		ProductVariantID: 2,
		AlertType:        AlertRestock,
		CreatedAt:        time.Unix(0, 0).UTC(),
		ProductTitle:     &title,
		ProductSlug:      &slug,
		CurrentPrice:     &price,
	}

	payload, err := json.Marshal(response)
	if err != nil {
		t.Fatalf("marshal product alert response: %v", err)
	}

	var body map[string]any
	if err := json.Unmarshal(payload, &body); err != nil {
		t.Fatalf("unmarshal product alert response: %v", err)
	}
	if body["product_title"] != title {
		t.Fatalf("product_title = %#v, want %q", body["product_title"], title)
	}
	if body["product_slug"] != slug {
		t.Fatalf("product_slug = %#v, want %q", body["product_slug"], slug)
	}
	gotPrice, ok := body["current_price"].(float64)
	if !ok || gotPrice != price {
		t.Fatalf("current_price = %#v, want %v", body["current_price"], price)
	}
}
