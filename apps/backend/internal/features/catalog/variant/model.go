package variant

import (
	"time"

	"github.com/tiredbooy/internal/models"
)

// ─────────────────────────────────────────────────────────────
// Core DB Models
// ─────────────────────────────────────────────────────────────

// OptionType / OptionValue live in features/catalog/option (BE-030).

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
	SKU            models.NullablePatch[string]  `json:"sku"`
	Price          *float64                      `json:"price" validate:"omitempty,min=0"`
	CompareAtPrice models.NullablePatch[float64] `json:"compare_at_price"`
	IsActive       *bool                         `json:"is_active"`
}
