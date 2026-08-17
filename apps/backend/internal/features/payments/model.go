package payments

import (
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"github.com/tiredbooy/internal/models"
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
	ID            int64                `db:"id"`
	OrderID       *int64               `db:"order_id"`
	UserID        *int64               `db:"user_id"`
	Amount        float64              `db:"amount"`
	Currency      string               `db:"currency"`
	Status        PaymentStatus        `db:"status"`
	PaymentMethod models.PaymentMethod `db:"payment_method"`
	TransactionID string               `db:"transaction_id"`
	RawResponse   []byte               `db:"raw_response"`
	ErrorMessage  *string              `db:"error_message"`
	PaidAt        *time.Time           `db:"paid_at"`
	CreatedAt     time.Time            `db:"created_at"`
	// PaymentURL is computed at read/create time from PAYMENT_START_BASE_URL
	// + transaction_id. Not stored.
	PaymentURL string `db:"-"`
	// UserUUID is users.user_id, joined on admin reads. Not stored on the row.
	UserUUID *uuid.UUID `db:"-"`
}

type CreatePaymentTransactionReq struct {
	// OrderID is nil for wallet gateway top-ups (PH-041a); set for order checkout.
	OrderID       *int64               `json:"-"`
	UserID        int64                `json:"-"`
	Amount        float64              `json:"-"`
	Currency      string               `json:"-"`
	PaymentMethod models.PaymentMethod `json:"-"`
	TransactionID string               `json:"-"`
}

// Wallet top-up amount bounds (IRT / Toman). Not multi-currency.
const (
	MinWalletTopUpAmount = 10_000.0
	MaxWalletTopUpAmount = 50_000_000.0
)

// TopUpIntent is returned to the customer after creating a pending gateway payment.
type TopUpIntent struct {
	PaymentID     int64         `json:"payment_id"`
	TransactionID string        `json:"transaction_id"`
	Amount        float64       `json:"amount"`
	Currency      string        `json:"currency"`
	Status        PaymentStatus `json:"status"`
	// PaymentURL is {PAYMENT_START_BASE_URL}?transaction_id={id}. Empty when
	// the base is unset (dev only; production requires the env).
	PaymentURL string `json:"payment_url"`
}

type ConfirmPaymentReq struct {
	TransactionID string `json:"-"`
	RawResponse   []byte `json:"-"`
}

// OrderEarnIntent is a payments-owned outbox row: persist in the Confirm TX,
// mark awarded_at only after AwardForOrder succeeds. Leftover NULL awarded_at
// rows are retried (PR-003h).
type OrderEarnIntent struct {
	OrderID   int64      `db:"order_id"`
	UserID    int64      `db:"user_id"`
	Amount    float64    `db:"amount"`
	CreatedAt time.Time  `db:"created_at"`
	AwardedAt *time.Time `db:"awarded_at"`
}

type FailPaymentReq struct {
	TransactionID string `json:"-"`
	ErrorMessage  string `json:"-"`
	RawResponse   []byte `json:"-"`
}

type PaymentTransactionFilter struct {
	models.BaseFilter
	UserID  *int64         `query:"user_id"`
	OrderID *int64         `query:"order_id"`
	Status  *PaymentStatus `query:"status"`
}

func (f *PaymentTransactionFilter) Defaults() {
	f.BaseFilter.Defaults("created_at")
}

type PaymentTransactionResponse struct {
	ID            int64                `json:"id"`
	OrderID       *int64               `json:"order_id,omitempty"`
	Amount        decimal.Decimal      `json:"amount"`
	Currency      string               `json:"currency"`
	Status        PaymentStatus        `json:"status"`
	PaymentMethod models.PaymentMethod `json:"payment_method"`
	TransactionID string               `json:"transaction_id"`
	PaymentURL    string               `json:"payment_url,omitempty"`
	ErrorMessage  *string              `json:"error_message,omitempty"`
	PaidAt        *time.Time           `json:"paid_at,omitempty"`
	CreatedAt     time.Time            `json:"created_at"`
}

type PaymentTransactionAdminResponse struct {
	PaymentTransactionResponse
	// UserID is users.user_id (public UUID), same as GET /admin/customers/:id.
	// Omitted when unset or the public id cannot be resolved. Never users.id.
	UserID      *uuid.UUID `json:"user_id,omitempty"`
	RawResponse []byte     `json:"raw_response,omitempty"`
}
