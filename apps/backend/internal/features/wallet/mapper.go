package wallet

import "strconv"

func decimal(value float64) string {
	return strconv.FormatFloat(value, 'f', 2, 64)
}

func optionalDecimal(value *float64) *string {
	if value == nil {
		return nil
	}
	formatted := decimal(*value)
	return &formatted
}

// ToResponse maps domain Wallet to public JSON (balance as string).
func ToResponse(w *Wallet) Response {
	return Response{
		ID:        w.ID,
		Balance:   decimal(w.Balance),
		CreatedAt: w.CreatedAt,
		UpdatedAt: w.UpdatedAt,
	}
}

// ToTransactionResponse maps a ledger row to public JSON.
func ToTransactionResponse(t *Transaction) TransactionResponse {
	return TransactionResponse{
		ID:               t.ID,
		Amount:           decimal(t.Amount),
		Type:             t.Type,
		Status:           t.Status,
		BalanceBefore:    optionalDecimal(t.BalanceBefore),
		BalanceAfter:     optionalDecimal(t.BalanceAfter),
		ReferenceOrderID: t.ReferenceOrderID,
		Description:      t.Description,
		CreatedAt:        t.CreatedAt,
	}
}
