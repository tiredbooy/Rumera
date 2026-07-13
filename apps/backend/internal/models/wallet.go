package models

import "time"

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

type Wallet struct {
	ID        int64     `db:"id"`
	UserID    int64     `db:"user_id"`
	Balance   float64   `db:"balance"`
	CreatedAt time.Time `db:"created_at"`
	UpdatedAt time.Time `db:"updated_at"`
}

type WalletTransaction struct {
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

type WithdrawReq struct {
	Amount      float64 `json:"amount"      validate:"required,gt=0"`
	Description *string `json:"description"`
}

type WalletTransactionFilter struct {
	BaseFilter
	Type   *TransactionType   `query:"type"`
	Status *TransactionStatus `query:"status"`
}

func (f *WalletTransactionFilter) Defaults() {
	f.BaseFilter.Defaults("created_at")
}

type WalletResponse struct {
	ID        int64     `json:"id"`
	Balance   string    `json:"balance"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type WalletTransactionResponse struct {
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
