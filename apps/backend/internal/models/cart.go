// internal/models/cart.go
package models

import "time"

// ─────────────────────────────────────────────────────────────
// Core DB Models
// ─────────────────────────────────────────────────────────────

type Cart struct {
	ID        int64     `db:"id"`
	UserID    *int64    `db:"user_id"` // nullable — guest carts have no user
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

type UpdateCartItemReq struct {
	Quantity int `json:"quantity" validate:"required,min=1,max=999"`
}

// ─────────────────────────────────────────────────────────────
// Responses
// ─────────────────────────────────────────────────────────────

type CartItemResponse struct {
	ID                int64                 `json:"id"`
	ProductID         int64                 `json:"product_id"`
	ProductTitle      string                `json:"product_title"`
	VariantID         int64                 `json:"variant_id"`
	SKU               *string               `json:"sku,omitempty"`
	UnitPriceSnapshot float64               `json:"unit_price_snapshot"`
	CurrentPrice      float64               `json:"current_price"`
	PriceChanged      bool                  `json:"price_changed"`
	Quantity          int                   `json:"quantity"`
	LineTotal         float64               `json:"line_total"`
	ImageURL          *string               `json:"image_url,omitempty"`
	Options           []OptionValueResponse `json:"options,omitempty"`
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
