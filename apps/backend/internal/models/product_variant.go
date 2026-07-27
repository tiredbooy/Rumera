package models

import "time"

// ─────────────────────────────────────────────────────────────
// Core DB Models
// ─────────────────────────────────────────────────────────────

type OptionType struct {
	ID          int64     `db:"id"           json:"id"`
	Title       string    `db:"title"        json:"title"`
	DisplayName string    `db:"display_name" json:"display_name"`
	CreatedAt   time.Time `db:"created_at"   json:"created_at"`
	UpdatedAt   time.Time `db:"updated_at"   json:"updated_at"`
}

type OptionValue struct {
	ID           int64     `db:"id"             json:"id"`
	OptionTypeID int64     `db:"option_type_id" json:"option_type_id"`
	Value        string    `db:"value"          json:"value"`
	SortOrder    int       `db:"sort_order"     json:"sort_order"`
	CreatedAt    time.Time `db:"created_at"     json:"created_at"`
	UpdatedAt    time.Time `db:"updated_at"     json:"updated_at"`
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
	OptionTypeID     int64 `db:"option_type_id"`
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
	SKU            NullablePatch[string]  `json:"sku"`
	Price          *float64               `json:"price" validate:"omitempty,min=0"`
	CompareAtPrice NullablePatch[float64] `json:"compare_at_price"`
	IsActive       *bool                  `json:"is_active"`
}

type CreateOptionTypeReq struct {
	Title       string `json:"title"        validate:"required,max=80"`
	DisplayName string `json:"display_name" validate:"required,max=100"`
}

type UpdateOptionTypeReq struct {
	Title       *string `json:"title"        validate:"omitempty,max=80"`
	DisplayName *string `json:"display_name" validate:"omitempty,max=100"`
}

type CreateOptionValueReq struct {
	Value     string `json:"value"      validate:"required,max=100"`
	SortOrder int    `json:"sort_order" validate:"min=0"`
}

type UpdateOptionValueReq struct {
	Value     *string `json:"value"      validate:"omitempty,max=100"`
	SortOrder *int    `json:"sort_order" validate:"omitempty,min=0"`
}
