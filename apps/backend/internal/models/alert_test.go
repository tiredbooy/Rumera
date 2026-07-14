package models

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
}
