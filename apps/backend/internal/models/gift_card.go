package models

import (
	"time"

	"github.com/shopspring/decimal"
)

type GiftCardStatus string

const (
	GiftCardStatusActive   GiftCardStatus = "active"
	GiftCardStatusRedeemed GiftCardStatus = "redeemed"
	GiftCardStatusDisabled GiftCardStatus = "disabled"
)

type GiftCard struct {
	ID              int64           `db:"id"`
	Code            string          `db:"code"`
	InitialAmount   decimal.Decimal `db:"initial_amount"`
	Status          GiftCardStatus  `db:"status"`
	PurchaserUserID *int64          `db:"purchaser_user_id"`
	RedeemedBy      *int64          `db:"redeemed_by"`
	RedeemedAt      *time.Time      `db:"redeemed_at"`
	CreatedAt       time.Time       `db:"created_at"`
}

// RedeemGiftCardReq — customer redeems a code into their wallet.
type RedeemGiftCardReq struct {
	Code string `json:"code" validate:"required"`
}

// CreateGiftCardsReq — admin issues one or more gift cards of a given amount.
type CreateGiftCardsReq struct {
	Amount decimal.Decimal `json:"amount"`
	Count  int             `json:"count" validate:"omitempty,min=1,max=500"`
}

// GiftCardResponse is the admin/issuer view (carries the code).
type GiftCardResponse struct {
	Code          string          `json:"code"`
	InitialAmount decimal.Decimal `json:"initial_amount"`
	Status        GiftCardStatus  `json:"status"`
	CreatedAt     time.Time       `json:"created_at"`
}

// RedeemGiftCardResult is returned to the customer after a successful redeem.
type RedeemGiftCardResult struct {
	Amount decimal.Decimal `json:"amount"`
}
