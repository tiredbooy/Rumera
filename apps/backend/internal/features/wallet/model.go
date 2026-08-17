package wallet

import (
	"time"

	"github.com/tiredbooy/internal/models"
)

type TransactionType string
type TransactionStatus string

const (
	TransactionTypeDeposit  TransactionType = "deposit"
	TransactionTypeWithdraw TransactionType = "withdraw"
	TransactionTypePurchase TransactionType = "purchase"
	TransactionTypeRefund   TransactionType = "refund"
)

const (
	TransactionStatusPending   TransactionStatus = "pending"
	TransactionStatusCompleted TransactionStatus = "completed"
	TransactionStatusFailed    TransactionStatus = "failed"
	TransactionStatusCancelled TransactionStatus = "cancelled"
)

// Wallet is the durable balance account for a user.
type Wallet struct {
	ID        int64     `db:"id"`
	UserID    int64     `db:"user_id"`
	Balance   float64   `db:"balance"`
	CreatedAt time.Time `db:"created_at"`
	UpdatedAt time.Time `db:"updated_at"`
}

// Transaction is a ledger row for a wallet.
type Transaction struct {
	ID               int64             `db:"id"`
	WalletID         int64             `db:"wallet_id"`
	Amount           float64           `db:"amount"`
	Type             TransactionType   `db:"type"`
	Status           TransactionStatus `db:"status"`
	BalanceBefore    *float64          `db:"balance_before"`
	BalanceAfter     *float64          `db:"balance_after"`
	ReferenceOrderID *int64            `db:"reference_order_id"`
	Description      *string           `db:"description"`
	CreatedAt        time.Time         `db:"created_at"`
}

// WithdrawReq was the body for the retired public withdraw path (kept for type docs).
type WithdrawReq struct {
	Amount      float64 `json:"amount"      validate:"required,gt=0"`
	Description *string `json:"description"`
}

// TransactionFilter is the query filter for GET /wallet/transactions.
type TransactionFilter struct {
	models.BaseFilter
	Type   *TransactionType   `query:"type"`
	Status *TransactionStatus `query:"status"`
}

func (f *TransactionFilter) Defaults() {
	f.BaseFilter.Defaults("created_at")
}

// Response is the public wallet JSON (balance as decimal string).
type Response struct {
	ID        int64     `json:"id"`
	Balance   string    `json:"balance"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// TransactionResponse is a public ledger row.
type TransactionResponse struct {
	ID               int64             `json:"id"`
	Amount           string            `json:"amount"`
	Type             TransactionType   `json:"type"`
	Status           TransactionStatus `json:"status"`
	BalanceBefore    *string           `json:"balance_before,omitempty"`
	BalanceAfter     *string           `json:"balance_after,omitempty"`
	ReferenceOrderID *int64            `json:"reference_order_id,omitempty"`
	Description      *string           `json:"description,omitempty"`
	CreatedAt        time.Time         `json:"created_at"`
}

// TopUpReq is the body for POST /wallet/topup (gateway-funded; not free deposit).
type TopUpReq struct {
	Amount float64 `json:"amount" validate:"required,gt=0"`
}

// TopUpResponse is the pending gateway intent for the customer (PH-041a).
type TopUpResponse struct {
	PaymentID     int64  `json:"payment_id"`
	TransactionID string `json:"transaction_id"`
	Amount        string `json:"amount"`
	Currency      string `json:"currency"`
	Status        string `json:"status"`
	// PaymentURL is {PAYMENT_START_BASE_URL}?transaction_id={id}. Empty when
	// the base is unset (dev only).
	PaymentURL string `json:"payment_url"`
}

// AdminCreditReq is the body for POST /admin/users/:userID/wallet/credit.
// IdempotencyKey is required so double-submits do not double-credit.
type AdminCreditReq struct {
	Amount         float64 `json:"amount" validate:"required,gt=0"`
	Description    string  `json:"description" validate:"omitempty,max=500"`
	IdempotencyKey string  `json:"idempotency_key" validate:"required,min=8,max=128"`
}

// AdminCreditResult is the ledger row plus audit metadata for operators.
type AdminCreditResult struct {
	Transaction
	ActorUserID    string `json:"actor_user_id"`
	IdempotencyKey string `json:"idempotency_key"`
	Replayed       bool   `json:"replayed"`
}
