package mappers

import "github.com/tiredbooy/internal/models"

func ToWalletResponse(w *models.Wallet) models.WalletResponse {
	return models.WalletResponse{
		ID:        w.ID,
		Balance:   w.Balance,
		CreatedAt: w.CreatedAt,
		UpdatedAt: w.UpdatedAt,
	}
}

func ToWalletTransactionResponse(t *models.WalletTransaction) models.WalletTransactionResponse {
	return models.WalletTransactionResponse{
		ID:               t.ID,
		Amount:           t.Amount,
		Type:             t.Type,
		Status:           t.Status,
		BalanceBefore:    t.BalanceBefore,
		BalanceAfter:     t.BalanceAfter,
		ReferenceOrderID: t.ReferenceOrderID,
		Description:      t.Description,
		CreatedAt:        t.CreatedAt,
	}
}
