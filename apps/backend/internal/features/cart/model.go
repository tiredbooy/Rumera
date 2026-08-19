package cart

import (
	"time"

	"github.com/tiredbooy/internal/models"
)

// ─────────────────────────────────────────────────────────────
// Core DB Models
// ─────────────────────────────────────────────────────────────

type Cart struct {
	ID        int64     `db:"id"`
	UserID    *int64    `db:"user_id"` // UNIQUE NOT NULL — one cart per authenticated user (no guests)
	CreatedAt time.Time `db:"created_at"`
	UpdatedAt time.Time `db:"updated_at"`
}

type CartItem struct {
	ID                int64     `db:"id"`
	CartID            int64     `db:"cart_id"`
	ProductVariantID  int64     `db:"product_variant_id"`
	Quantity          int       `db:"quantity"`
	UnitPriceSnapshot float64   `db:"unit_price_snapshot"`
	CreatedAt         time.Time `db:"created_at"`
	UpdatedAt         time.Time `db:"updated_at"`
}

// ─────────────────────────────────────────────────────────────
// Requests
// ─────────────────────────────────────────────────────────────

type AddCartItemReq struct {
	ProductVariantID  int64   `json:"product_variant_id" validate:"required,min=1"`
	Quantity          int     `json:"quantity"           validate:"required,min=1,max=999"`
	UnitPriceSnapshot float64 `json:"-"` // set by service, never from client input
}

// AddCartItemsReq is the payload for the bulk add endpoint (e.g. "add all recipe
// ingredients to cart"). Unavailable/unknown variants are skipped, not fatal.
type AddCartItemsReq struct {
	Items []AddCartItemReq `json:"items" validate:"required,min=1,max=100,dive"`
}

type UpdateCartItemReq struct {
	Quantity int `json:"quantity" validate:"required,min=1,max=999"`
}

// ─────────────────────────────────────────────────────────────
// Responses
// ─────────────────────────────────────────────────────────────

type CartItemResponse struct {
	ID           int64  `json:"id"`
	ProductID    int64  `json:"product_id"`
	ProductTitle string `json:"product_title"`
	// CategoryID is the product's current category (nullable when uncategorised).
	// Used for coupon applicability during order creation; omitted from sparse
	// client payloads when nil.
	CategoryID *int64 `json:"category_id,omitempty"`
	// WeightKg is the product's unit weight when known (catalog weight column).
	WeightKg          *float64 `json:"weight_kg,omitempty"`
	VariantID         int64    `json:"variant_id"`
	SKU               *string  `json:"sku,omitempty"`
	UnitPriceSnapshot float64  `json:"unit_price_snapshot"`
	CurrentPrice      float64  `json:"current_price"`
	PriceChanged      bool     `json:"price_changed"`
	Quantity          int      `json:"quantity"`
	// AvailableStock is the sellable stock for this variant right now
	// (inventory.stock_on_hand - committed_stock, clamped at zero) — the same
	// number the reserve path checks at checkout. Zero means sold out; a value
	// below Quantity means the line cannot be ordered as it stands.
	AvailableStock int                          `json:"available_stock"`
	LineTotal      float64                      `json:"line_total"`
	ImageURL       *string                      `json:"image_url,omitempty"`
	Options        []models.OptionValueResponse `json:"options,omitempty"`
}

type CartResponse struct {
	ID      int64              `json:"id"`
	Items   []CartItemResponse `json:"items"`
	Summary CartSummary        `json:"summary"`
}

type CartSummary struct {
	TotalItems    int     `json:"total_items"`
	UniqueItems   int     `json:"unique_items"`
	Subtotal      float64 `json:"subtotal"`
	DiscountTotal float64 `json:"discount_total"`
}

// SkippedCartItem reports a variant the bulk add couldn't honour.
// Reason ∈ {"invalid","not_found","unavailable","out_of_stock"}.
type SkippedCartItem struct {
	ProductVariantID int64  `json:"product_variant_id"`
	Reason           string `json:"reason"`
}

// BulkAddResult is returned by the bulk add endpoint: the refreshed cart plus a
// per-variant skip list so the UI can tell the user what couldn't be added.
type BulkAddResult struct {
	Cart    *CartResponse     `json:"cart"`
	Added   int               `json:"added"`
	Skipped []SkippedCartItem `json:"skipped"`
}
