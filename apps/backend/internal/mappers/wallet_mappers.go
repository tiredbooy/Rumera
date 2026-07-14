package mappers

import (
	"strconv"

	"github.com/tiredbooy/internal/models"
)

func walletDecimal(value float64) string {
	return strconv.FormatFloat(value, 'f', 2, 64)
}

func optionalWalletDecimal(value *float64) *string {
	if value == nil {
		return nil
	}
	formatted := walletDecimal(*value)
	return &formatted
}

func ToWalletResponse(w *models.Wallet) models.WalletResponse {
	return models.WalletResponse{
		ID:        w.ID,
		Balance:   walletDecimal(w.Balance),
		CreatedAt: w.CreatedAt,
		UpdatedAt: w.UpdatedAt,
	}
}

func ToWalletTransactionResponse(t *models.WalletTransaction) models.WalletTransactionResponse {
	return models.WalletTransactionResponse{
		ID:               t.ID,
		Amount:           walletDecimal(t.Amount),
		Type:             t.Type,
		Status:           t.Status,
		BalanceBefore:    optionalWalletDecimal(t.BalanceBefore),
		BalanceAfter:     optionalWalletDecimal(t.BalanceAfter),
		ReferenceOrderID: t.ReferenceOrderID,
		Description:      t.Description,
		CreatedAt:        t.CreatedAt,
	}
}
