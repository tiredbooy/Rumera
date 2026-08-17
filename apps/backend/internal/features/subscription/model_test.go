package subscription

import (
	"encoding/json"
	"testing"
	"time"
)

func TestSubscriptionResponseOmitsNilAddressID(t *testing.T) {
	payload, err := json.Marshal(SubscriptionResponse{
		ID:      1,
		Plan:    PlanCellarBox,
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

func TestUpdateSubscriptionReqJSON(t *testing.T) {
	var addressOnly UpdateSubscriptionReq
	if err := json.Unmarshal([]byte(`{"address_id":12}`), &addressOnly); err != nil {
		t.Fatalf("unmarshal address-only: %v", err)
	}
	if addressOnly.Action != "" {
		t.Fatalf("action = %q, want empty", addressOnly.Action)
	}
	if addressOnly.AddressID == nil || *addressOnly.AddressID != 12 {
		t.Fatalf("address_id = %v, want 12", addressOnly.AddressID)
	}
	if !addressOnly.HasPatch() {
		t.Fatal("address-only must count as a patch")
	}

	var both UpdateSubscriptionReq
	if err := json.Unmarshal([]byte(`{"action":"pause","address_id":3}`), &both); err != nil {
		t.Fatalf("unmarshal action+address: %v", err)
	}
	if both.Action != SubscriptionActionPause {
		t.Fatalf("action = %q, want pause", both.Action)
	}
	if both.AddressID == nil || *both.AddressID != 3 {
		t.Fatalf("address_id = %v, want 3", both.AddressID)
	}

	var empty UpdateSubscriptionReq
	if err := json.Unmarshal([]byte(`{}`), &empty); err != nil {
		t.Fatalf("unmarshal empty: %v", err)
	}
	if empty.HasPatch() {
		t.Fatal("empty body must not count as a patch")
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

func TestNextRenewal(t *testing.T) {
	from := time.Date(2026, 1, 15, 12, 0, 0, 0, time.UTC)
	monthly := NextRenewal(from, SubscriptionCadenceMonthly)
	if monthly.Month() != time.February || monthly.Day() != 15 {
		t.Fatalf("monthly next = %v, want Feb 15", monthly)
	}
	quarterly := NextRenewal(from, SubscriptionCadenceQuarterly)
	if quarterly.Month() != time.April || quarterly.Day() != 15 {
		t.Fatalf("quarterly next = %v, want Apr 15", quarterly)
	}
	// Unknown cadence falls back to monthly.
	fallback := NextRenewal(from, "weekly")
	if !fallback.Equal(monthly) {
		t.Fatalf("fallback next = %v, want monthly %v", fallback, monthly)
	}
}

func TestAllowedAction(t *testing.T) {
	cases := []struct {
		status SubscriptionStatus
		action SubscriptionAction
		want   bool
	}{
		{SubscriptionStatusActive, SubscriptionActionPause, true},
		{SubscriptionStatusActive, SubscriptionActionSkip, true},
		{SubscriptionStatusActive, SubscriptionActionCancel, true},
		{SubscriptionStatusActive, SubscriptionActionResume, false},
		{SubscriptionStatusPaused, SubscriptionActionResume, true},
		{SubscriptionStatusPaused, SubscriptionActionCancel, true},
		{SubscriptionStatusPaused, SubscriptionActionPause, false},
		{SubscriptionStatusPaused, SubscriptionActionSkip, false},
		{SubscriptionStatusCancelled, SubscriptionActionResume, true},
		{SubscriptionStatusCancelled, SubscriptionActionCancel, false},
		{SubscriptionStatusCancelled, SubscriptionActionSkip, false},
		{SubscriptionStatusCancelled, SubscriptionActionPause, false},
		{SubscriptionStatusActive, SubscriptionAction("noop"), false},
	}
	for _, tc := range cases {
		got := AllowedAction(tc.status, tc.action)
		if got != tc.want {
			t.Errorf("AllowedAction(%s, %s) = %v, want %v", tc.status, tc.action, got, tc.want)
		}
	}
}
