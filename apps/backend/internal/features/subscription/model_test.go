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
