package payments

import (
	"github.com/shopspring/decimal"
)

func ToPaymentTransactionResponse(pt *PaymentTransaction) PaymentTransactionResponse {
	return PaymentTransactionResponse{
		ID:            pt.ID,
		OrderID:       pt.OrderID,
		Amount:        decimal.NewFromFloat(pt.Amount),
		Currency:      pt.Currency,
		Status:        pt.Status,
		PaymentMethod: pt.PaymentMethod,
		TransactionID: pt.TransactionID,
		ErrorMessage:  pt.ErrorMessage,
		PaidAt:        pt.PaidAt,
		CreatedAt:     pt.CreatedAt,
	}
}

func ToPaymentTransactionAdminResponse(pt *PaymentTransaction) PaymentTransactionAdminResponse {
	return PaymentTransactionAdminResponse{
		PaymentTransactionResponse: ToPaymentTransactionResponse(pt),
		UserID:                     pt.UserID,
		RawResponse:                pt.RawResponse,
	}
}
