package mappers

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/tiredbooy/internal/models"
)

func TestToWalletResponseFormatsBalanceAsDecimalString(t *testing.T) {
	response := ToWalletResponse(&models.Wallet{ID: 9, Balance: 113})

	if response.Balance != "113.00" {
		t.Fatalf("Balance = %q, want %q", response.Balance, "113.00")
	}
}

func TestToWalletTransactionResponseFormatsAndOmitsNullableFields(t *testing.T) {
	balanceBefore := 113.5
	response := ToWalletTransactionResponse(&models.WalletTransaction{
		ID:            7781,
		Amount:        50,
		Type:          models.TransactionTypeDeposit,
		Status:        models.TransactionStatusCompleted,
		BalanceBefore: &balanceBefore,
	})

	if response.Amount != "50.00" {
		t.Fatalf("Amount = %q, want %q", response.Amount, "50.00")
	}
	if response.BalanceBefore == nil || *response.BalanceBefore != "113.50" {
		t.Fatalf("BalanceBefore = %v, want 113.50", response.BalanceBefore)
	}

	encoded, err := json.Marshal(response)
	if err != nil {
		t.Fatalf("Marshal() error = %v", err)
	}
	jsonBody := string(encoded)
	for _, field := range []string{"balance_after", "reference_order_id", "description"} {
		if strings.Contains(jsonBody, `"`+field+`"`) {
			t.Errorf("JSON unexpectedly contains omitted field %q: %s", field, jsonBody)
		}
	}
}
