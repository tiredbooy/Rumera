package referral

import (
	"encoding/json"
	"testing"
)

func TestReferralResponseJSONContract(t *testing.T) {
	got, err := json.Marshal(ReferralResponse{
		Code:      "RUMERA24",
		Pending:   2,
		Completed: 3,
		Reward:    300,
	})
	if err != nil {
		t.Fatalf("marshal referral response: %v", err)
	}

	want := `{"code":"RUMERA24","pending":2,"completed":3,"reward":300}`
	if string(got) != want {
		t.Fatalf("unexpected referral response JSON: got %s, want %s", got, want)
	}
}

func TestClaimReferralInputJSONContract(t *testing.T) {
	got, err := json.Marshal(ClaimReferralInput{Code: "RUMERA24"})
	if err != nil {
		t.Fatalf("marshal claim referral input: %v", err)
	}

	want := `{"code":"RUMERA24"}`
	if string(got) != want {
		t.Fatalf("unexpected claim referral input JSON: got %s, want %s", got, want)
	}
}

func TestClaimReferralResponseJSONContract(t *testing.T) {
	got, err := json.Marshal(ClaimReferralResponse{Claimed: true})
	if err != nil {
		t.Fatalf("marshal claim referral response: %v", err)
	}

	want := `{"claimed":true}`
	if string(got) != want {
		t.Fatalf("unexpected claim referral response JSON: got %s, want %s", got, want)
	}
}
