package giftcard

import (
	"encoding/json"
	"testing"

	"github.com/shopspring/decimal"
)

func TestGiftCardResponsesMarshalAmountsAsDecimalStrings(t *testing.T) {
	issued, err := json.Marshal(GiftCardResponse{
		Code:          "ABCD-EFGH-JKLM-NPQR",
		InitialAmount: decimal.RequireFromString("125000.50"),
		Status:        GiftCardStatusActive,
	})
	if err != nil {
		t.Fatalf("marshal issued gift card: %v", err)
	}

	redeemed, err := json.Marshal(RedeemGiftCardResult{
		Amount: decimal.RequireFromString("125000.50"),
	})
	if err != nil {
		t.Fatalf("marshal gift card redemption: %v", err)
	}

	var issuedBody map[string]any
	if err := json.Unmarshal(issued, &issuedBody); err != nil {
		t.Fatalf("unmarshal issued gift card: %v", err)
	}
	if issuedBody["initial_amount"] != "125000.5" {
		t.Fatalf("initial_amount = %#v, want decimal string %q", issuedBody["initial_amount"], "125000.5")
	}
	if issuedBody["status"] != string(GiftCardStatusActive) {
		t.Fatalf("status = %#v, want %q", issuedBody["status"], GiftCardStatusActive)
	}

	var redeemedBody map[string]any
	if err := json.Unmarshal(redeemed, &redeemedBody); err != nil {
		t.Fatalf("unmarshal gift card redemption: %v", err)
	}
	if redeemedBody["amount"] != "125000.5" {
		t.Fatalf("amount = %#v, want decimal string %q", redeemedBody["amount"], "125000.5")
	}
}

func TestCreateGiftCardsReqAcceptsDecimalString(t *testing.T) {
	var input CreateGiftCardsReq
	if err := json.Unmarshal([]byte(`{"amount":"125000.50","count":2}`), &input); err != nil {
		t.Fatalf("unmarshal gift card input: %v", err)
	}

	if !input.Amount.Equal(decimal.RequireFromString("125000.50")) {
		t.Fatalf("amount = %s, want 125000.50", input.Amount)
	}
	if input.Count != 2 {
		t.Fatalf("count = %d, want 2", input.Count)
	}
}
