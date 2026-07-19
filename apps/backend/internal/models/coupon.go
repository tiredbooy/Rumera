// internal/models/coupon.go
package models

import (
	"bytes"
	"encoding/json"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
)

type DiscountType string

const (
	DiscountTypePercentage   DiscountType = "percentage"
	DiscountTypeFixedAmount  DiscountType = "fixed_amount"
	DiscountTypeFreeShipping DiscountType = "free_shipping"
)

type ApplicableTo struct {
	CategoryIDs []int64 `json:"category_ids,omitempty"`
	ProductIDs  []int64 `json:"product_ids,omitempty"`
}

// NullablePatch distinguishes an omitted PATCH field from an explicit JSON null.
// Value is nil only when the client intentionally clears a nullable column.
type NullablePatch[T any] struct {
	Set   bool
	Value *T
}

func (p *NullablePatch[T]) UnmarshalJSON(data []byte) error {
	p.Set = true
	if bytes.Equal(bytes.TrimSpace(data), []byte("null")) {
		p.Value = nil
		return nil
	}

	var value T
	if err := json.Unmarshal(data, &value); err != nil {
		return err
	}
	p.Value = &value
	return nil
}

type Coupon struct {
	ID                int64         `db:"id"`
	Code              string        `db:"code"`
	Description       *string       `db:"description"`
	DiscountType      DiscountType  `db:"discount_type"`
	DiscountValue     float64       `db:"discount_value"`
	MaxDiscountAmount *float64      `db:"max_discount_amount"`
	MinOrderAmount    float64       `db:"min_order_amount"`
	MaxUses           *int          `db:"max_uses"`
	MaxUsesPerUser    int           `db:"max_uses_per_user"`
	ApplicableTo      *ApplicableTo `db:"applicable_to"`
	IsActive          bool          `db:"is_active"`
	StartsAt          time.Time     `db:"starts_at"`
	ExpiresAt         *time.Time    `db:"expires_at"`
	CreatedAt         time.Time     `db:"created_at"`
	UpdatedAt         time.Time     `db:"updated_at"`
}

type CouponUsage struct {
	ID              int64     `db:"id"`
	CouponID        int64     `db:"coupon_id"`
	UserID          int64     `db:"user_id"`
	OrderID         int64     `db:"order_id"`
	DiscountApplied float64   `db:"discount_applied"`
	UsedAt          time.Time `db:"used_at"`
}

type CreateCouponReq struct {
	Code              string        `json:"code"                validate:"required,max=64"`
	Description       *string       `json:"description"`
	DiscountType      DiscountType  `json:"discount_type"       validate:"required,oneof=percentage fixed_amount free_shipping"`
	DiscountValue     float64       `json:"discount_value"      validate:"min=0"`
	MaxDiscountAmount *float64      `json:"max_discount_amount" validate:"omitempty,gt=0"`
	MinOrderAmount    float64       `json:"min_order_amount"    validate:"min=0"`
	MaxUses           *int          `json:"max_uses"            validate:"omitempty,min=1"`
	MaxUsesPerUser    int           `json:"max_uses_per_user"   validate:"min=1"`
	ApplicableTo      *ApplicableTo `json:"applicable_to"`
	IsActive          *bool         `json:"is_active"`
	StartsAt          *time.Time    `json:"starts_at"`
	ExpiresAt         *time.Time    `json:"expires_at"`
}

type UpdateCouponReq struct {
	Description       NullablePatch[string]       `json:"description"`
	DiscountValue     NullablePatch[float64]      `json:"discount_value"`
	MaxDiscountAmount NullablePatch[float64]      `json:"max_discount_amount"`
	MinOrderAmount    NullablePatch[float64]      `json:"min_order_amount"`
	MaxUses           NullablePatch[int]          `json:"max_uses"`
	MaxUsesPerUser    NullablePatch[int]          `json:"max_uses_per_user"`
	ApplicableTo      NullablePatch[ApplicableTo] `json:"applicable_to"`
	IsActive          NullablePatch[bool]         `json:"is_active"`
	StartsAt          NullablePatch[time.Time]    `json:"starts_at"`
	ExpiresAt         NullablePatch[time.Time]    `json:"expires_at"`
	ExpectedUpdatedAt time.Time                   `json:"-"`
}

type ValidateCouponReq struct {
	Code          string  `json:"code"           validate:"required"`
	UserID        int64   `json:"-"`
	OrderSubtotal float64 `json:"order_subtotal" validate:"min=0"`
	ProductIDs    []int64 `json:"product_ids"`
	CategoryIDs   []int64 `json:"category_ids"`
}

// ─────────────────────────────────────────────────────────────
// Filters
// ─────────────────────────────────────────────────────────────

type CouponFilter struct {
	BaseFilter
	IsActive     *bool         `query:"is_active"`
	DiscountType *DiscountType `query:"discount_type"`
	ActiveOnly   bool          `query:"active_only"`
}

func (f *CouponFilter) Defaults() {
	f.BaseFilter.Defaults("created_at")
}

type CouponResponse struct {
	ID                int64         `json:"id"`
	Code              string        `json:"code"`
	Description       *string       `json:"description,omitempty"`
	DiscountType      DiscountType  `json:"discount_type"`
	DiscountValue     float64       `json:"discount_value"`
	MaxDiscountAmount *float64      `json:"max_discount_amount,omitempty"`
	MinOrderAmount    float64       `json:"min_order_amount"`
	MaxUses           *int          `json:"max_uses,omitempty"`
	MaxUsesPerUser    int           `json:"max_uses_per_user"`
	ApplicableTo      *ApplicableTo `json:"applicable_to,omitempty"`
	IsActive          bool          `json:"is_active"`
	StartsAt          time.Time     `json:"starts_at"`
	ExpiresAt         *time.Time    `json:"expires_at,omitempty"`
	TotalUses         int           `json:"total_uses"` // joined from coupon_usages count
}

type CouponValidationResult struct {
	Coupon         *Coupon `json:"coupon"`
	DiscountAmount float64 `json:"discount_amount"` // calculated discount
	FreeShipping   bool    `json:"free_shipping"`
	IsValid        bool    `json:"is_valid"`
	InvalidReason  string  `json:"invalid_reason,omitempty"`
}

var _ = pgtype.Text{}
