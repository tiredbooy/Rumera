package models

import (
	"time"

	"github.com/shopspring/decimal"
)

type PaymentStatus string

const (
	PaymentStatusPending           PaymentStatus = "pending"
	PaymentStatusSucceeded         PaymentStatus = "succeeded"
	PaymentStatusFailed            PaymentStatus = "failed"
	PaymentStatusRefunded          PaymentStatus = "refunded"
	PaymentStatusPartiallyRefunded PaymentStatus = "partially_refunded"
)

type PaymentTransaction struct {
	ID            int64         `db:"id"`
	OrderID       *int64        `db:"order_id"`
	UserID        *int64        `db:"user_id"`
	Amount        float64       `db:"amount"`
	Currency      string        `db:"currency"`
	Status        PaymentStatus `db:"status"`
	PaymentMethod PaymentMethod `db:"payment_method"`
	TransactionID string        `db:"transaction_id"`
	RawResponse   []byte        `db:"raw_response"`
	ErrorMessage  *string       `db:"error_message"`
	PaidAt        *time.Time    `db:"paid_at"`
	CreatedAt     time.Time     `db:"created_at"`
}

type CreatePaymentTransactionReq struct {
	OrderID       int64         `json:"-"`
	UserID        int64         `json:"-"`
	Amount        float64       `json:"-"`
	Currency      string        `json:"-"`
	PaymentMethod PaymentMethod `json:"-"`
	TransactionID string        `json:"-"`
}

type ConfirmPaymentReq struct {
	TransactionID string `json:"-"`
	RawResponse   []byte `json:"-"`
}

type FailPaymentReq struct {
	TransactionID string `json:"-"`
	ErrorMessage  string `json:"-"`
	RawResponse   []byte `json:"-"`
}

type PaymentTransactionFilter struct {
	BaseFilter
	UserID  *int64         `query:"user_id"`
	OrderID *int64         `query:"order_id"`
	Status  *PaymentStatus `query:"status"`
}

func (f *PaymentTransactionFilter) Defaults() {
	f.BaseFilter.Defaults("created_at")
}

type PaymentTransactionResponse struct {
	ID            int64           `json:"id"`
	OrderID       *int64          `json:"order_id,omitempty"`
	Amount        decimal.Decimal `json:"amount"`
	Currency      string          `json:"currency"`
	Status        PaymentStatus   `json:"status"`
	PaymentMethod PaymentMethod   `json:"payment_method"`
	TransactionID string          `json:"transaction_id"`
	ErrorMessage  *string         `json:"error_message,omitempty"`
	PaidAt        *time.Time      `json:"paid_at,omitempty"`
	CreatedAt     time.Time       `json:"created_at"`
}

type PaymentTransactionAdminResponse struct {
	PaymentTransactionResponse
	UserID      *int64 `json:"user_id,omitempty"`
	RawResponse []byte `json:"raw_response,omitempty"`
}
