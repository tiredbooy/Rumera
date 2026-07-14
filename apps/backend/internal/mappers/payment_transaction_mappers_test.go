package mappers

import (
	"encoding/json"
	"testing"

	"github.com/tiredbooy/internal/models"
)

func TestPaymentTransactionAdminResponseJSONContract(t *testing.T) {
	response := ToPaymentTransactionAdminResponse(&models.PaymentTransaction{
		ID:            501,
		Amount:        89.9,
		Currency:      "USD",
		Status:        models.PaymentStatusSucceeded,
		PaymentMethod: models.PaymentMethodCard,
		TransactionID: "tx-501",
		RawResponse:   []byte(`{"id":"gateway-501"}`),
	})

	payload, err := json.Marshal(response)
	if err != nil {
		t.Fatalf("marshal payment transaction: %v", err)
	}

	var got map[string]any
	if err := json.Unmarshal(payload, &got); err != nil {
		t.Fatalf("unmarshal payment transaction: %v", err)
	}

	if got["amount"] != "89.9" {
		t.Fatalf("amount = %#v, want decimal string %q", got["amount"], "89.9")
	}
	if got["raw_response"] != "eyJpZCI6ImdhdGV3YXktNTAxIn0=" {
		t.Fatalf("raw_response = %#v, want base64 gateway payload", got["raw_response"])
	}
	if _, exists := got["order_id"]; exists {
		t.Fatal("order_id must be omitted when unset")
	}
	if _, exists := got["user_id"]; exists {
		t.Fatal("user_id must be omitted when unset")
	}
}
