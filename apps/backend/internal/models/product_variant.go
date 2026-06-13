package models

import "time"

// ─────────────────────────────────────────────────────────────
// Core DB Models
// ─────────────────────────────────────────────────────────────

type OptionType struct {
	ID          int64     `db:"id"`
	Title       *string   `db:"title"`
	DisplayName *string   `db:"display_name"`
	CreatedAt   time.Time `db:"created_at"`
	UpdatedAt   time.Time `db:"updated_at"`
}

type OptionValue struct {
	ID        int64     `db:"id"`
	VariantID int64     `db:"variant_id"` // FK → option_types.id
	Value     string    `db:"value"`
	SortOrder int       `db:"sort_order"`
	CreatedAt time.Time `db:"created_at"`
}

type ProductVariant struct {
	ID             int64     `db:"id"`
	ProductID      int64     `db:"product_id"`
	SKU            *string   `db:"sku"`
	Price          float64   `db:"price"`
	CompareAtPrice *float64  `db:"compare_at_price"`
	IsActive       bool      `db:"is_active"`
	CreatedAt      time.Time `db:"created_at"`
	UpdatedAt      time.Time `db:"updated_at"`
}

type ProductVariantOption struct {
	ID               int64 `db:"id"`
	ProductVariantID int64 `db:"product_variant_id"`
	VariantOptionID  int64 `db:"variant_option_id"`
}

// ─────────────────────────────────────────────────────────────
// Requests
// ─────────────────────────────────────────────────────────────

type CreateVariantReq struct {
	SKU            *string  `json:"sku"              validate:"omitempty,max=250"`
	Price          float64  `json:"price"            validate:"required,min=0"`
	CompareAtPrice *float64 `json:"compare_at_price" validate:"omitempty,min=0"`
	OptionValueIDs []int64  `json:"option_value_ids"` // links to product_variants_options
}

type UpdateVariantReq struct {
	SKU            *string  `json:"sku"              validate:"omitempty,max=250"`
	Price          *float64 `json:"price"            validate:"omitempty,min=0"`
	CompareAtPrice *float64 `json:"compare_at_price" validate:"omitempty,min=0"`
	IsActive       *bool    `json:"is_active"`
}
