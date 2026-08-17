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

func TestAdminGiftCardResponseIncludesIDAndOptionalPurchase(t *testing.T) {
	txID := "gbuy-xyz"
	uid := int64(4)
	payload, err := json.Marshal(toAdminGiftCard(GiftCard{
		ID:              11,
		Code:            "ABCD-EFGH-JKLM-NPQR",
		InitialAmount:   decimal.RequireFromString("125000.50"),
		Status:          GiftCardStatusDisabled,
		PurchaserUserID: &uid,
		PurchaseTxID:    &txID,
	}))
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	var got map[string]any
	if err := json.Unmarshal(payload, &got); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if got["id"] != float64(11) {
		t.Fatalf("id = %#v", got["id"])
	}
	if got["status"] != string(GiftCardStatusDisabled) {
		t.Fatalf("status = %#v", got["status"])
	}
	if got["purchase_txid"] != "gbuy-xyz" {
		t.Fatalf("purchase_txid = %#v", got["purchase_txid"])
	}
	if got["initial_amount"] != "125000.5" {
		t.Fatalf("initial_amount = %#v", got["initial_amount"])
	}
}

func TestAdminFilterDefaultsAndNormalizes(t *testing.T) {
	var f AdminFilter
	f.Status = "ACTIVE"
	f.Search = "  abcd-efgh  "
	f.Defaults()
	if f.Page != 1 || f.Limit != 20 {
		t.Fatalf("page/limit = %d/%d", f.Page, f.Limit)
	}
	if f.Status != GiftCardStatusActive {
		t.Fatalf("status = %q", f.Status)
	}
	if f.Search != "ABCD-EFGH" {
		t.Fatalf("search = %q", f.Search)
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

func TestPurchaseIntentResponseJSON_PaymentURL(t *testing.T) {
	payload, err := json.Marshal(PurchaseIntentResponse{
		PaymentID:     12,
		TransactionID: "gbuy-xyz",
		Amount:        "100000.00",
		Currency:      "IRT",
		Status:        "pending",
		PaymentURL:    "https://pay.example.com/start?transaction_id=gbuy-xyz",
	})
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	var got map[string]any
	if err := json.Unmarshal(payload, &got); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if got["payment_url"] != "https://pay.example.com/start?transaction_id=gbuy-xyz" {
		t.Fatalf("payment_url = %#v", got["payment_url"])
	}

	empty, err := json.Marshal(PurchaseIntentResponse{TransactionID: "gbuy-xyz"})
	if err != nil {
		t.Fatalf("marshal empty: %v", err)
	}
	var emptyGot map[string]any
	if err := json.Unmarshal(empty, &emptyGot); err != nil {
		t.Fatalf("unmarshal empty: %v", err)
	}
	if emptyGot["payment_url"] != "" {
		t.Fatalf("unset payment_url = %#v; want empty string", emptyGot["payment_url"])
	}
}
