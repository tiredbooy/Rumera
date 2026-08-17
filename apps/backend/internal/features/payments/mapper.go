package payments

import (
	"github.com/google/uuid"
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
		PaymentURL:    pt.PaymentURL,
		ErrorMessage:  pt.ErrorMessage,
		PaidAt:        pt.PaidAt,
		CreatedAt:     pt.CreatedAt,
	}
}

func ToPaymentTransactionAdminResponse(pt *PaymentTransaction) PaymentTransactionAdminResponse {
	var userID *uuid.UUID
	if pt.UserUUID != nil && *pt.UserUUID != uuid.Nil {
		userID = pt.UserUUID
	}
	return PaymentTransactionAdminResponse{
		PaymentTransactionResponse: ToPaymentTransactionResponse(pt),
		UserID:                     userID,
		RawResponse:                pt.RawResponse,
	}
}
