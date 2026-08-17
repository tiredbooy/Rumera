package payments

import (
	"encoding/json"
	"testing"

	"github.com/google/uuid"
	"github.com/tiredbooy/internal/models"
)

func TestPaymentTransactionAdminResponseJSONContract(t *testing.T) {
	response := ToPaymentTransactionAdminResponse(&PaymentTransaction{
		ID:            501,
		Amount:        89.9,
		Currency:      "USD",
		Status:        PaymentStatusSucceeded,
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

func TestPaymentTransactionAdminResponseJSONContract_UserIDIsPublicUUID(t *testing.T) {
	internal := int64(42)
	public := uuid.MustParse("11111111-1111-1111-1111-111111111111")
	response := ToPaymentTransactionAdminResponse(&PaymentTransaction{
		ID:            501,
		UserID:        &internal,
		UserUUID:      &public,
		Amount:        10,
		Currency:      "IRT",
		Status:        PaymentStatusSucceeded,
		PaymentMethod: models.PaymentMethodCard,
		TransactionID: "tx-501",
	})

	payload, err := json.Marshal(response)
	if err != nil {
		t.Fatalf("marshal payment transaction: %v", err)
	}

	var got map[string]any
	if err := json.Unmarshal(payload, &got); err != nil {
		t.Fatalf("unmarshal payment transaction: %v", err)
	}

	if got["user_id"] != "11111111-1111-1111-1111-111111111111" {
		t.Fatalf("user_id = %#v, want public UUID", got["user_id"])
	}
}

func TestPaymentTransactionAdminResponseJSONContract_OmitsInternalUserID(t *testing.T) {
	internal := int64(42)
	response := ToPaymentTransactionAdminResponse(&PaymentTransaction{
		ID:            501,
		UserID:        &internal,
		Amount:        10,
		Currency:      "IRT",
		Status:        PaymentStatusSucceeded,
		PaymentMethod: models.PaymentMethodCard,
		TransactionID: "tx-502",
	})

	payload, err := json.Marshal(response)
	if err != nil {
		t.Fatalf("marshal payment transaction: %v", err)
	}

	var got map[string]any
	if err := json.Unmarshal(payload, &got); err != nil {
		t.Fatalf("unmarshal payment transaction: %v", err)
	}

	if _, exists := got["user_id"]; exists {
		t.Fatalf("user_id = %#v, must omit unresolved internal id", got["user_id"])
	}
}
