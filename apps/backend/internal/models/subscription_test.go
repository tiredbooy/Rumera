package models

import (
	"encoding/json"
	"testing"
)

func TestSubscriptionResponseOmitsNilAddressID(t *testing.T) {
	payload, err := json.Marshal(SubscriptionResponse{
		ID:      1,
		Plan:    "cellar-box",
		Cadence: SubscriptionCadenceMonthly,
		Status:  SubscriptionStatusActive,
	})
	if err != nil {
		t.Fatalf("marshal response: %v", err)
	}

	var body map[string]any
	if err := json.Unmarshal(payload, &body); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if _, exists := body["address_id"]; exists {
		t.Fatal("address_id must be omitted when nil")
	}
}

func TestCreateSubscriptionReqAddressIDNullability(t *testing.T) {
	for _, input := range []string{
		`{"cadence":"monthly"}`,
		`{"cadence":"monthly","address_id":null}`,
	} {
		var req CreateSubscriptionReq
		if err := json.Unmarshal([]byte(input), &req); err != nil {
			t.Fatalf("unmarshal %s: %v", input, err)
		}
		if req.Cadence != SubscriptionCadenceMonthly {
			t.Fatalf("cadence = %q, want %q", req.Cadence, SubscriptionCadenceMonthly)
		}
		if req.AddressID != nil {
			t.Fatalf("address_id = %v, want nil", *req.AddressID)
		}
	}
}
