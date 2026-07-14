package mappers

import (
	"github.com/shopspring/decimal"
	"github.com/tiredbooy/internal/models"
)

func ToPaymentTransactionResponse(pt *models.PaymentTransaction) models.PaymentTransactionResponse {
	return models.PaymentTransactionResponse{
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

func ToPaymentTransactionAdminResponse(pt *models.PaymentTransaction) models.PaymentTransactionAdminResponse {
	return models.PaymentTransactionAdminResponse{
		PaymentTransactionResponse: ToPaymentTransactionResponse(pt),
		UserID:                     pt.UserID,
		RawResponse:                pt.RawResponse,
	}
}
