package models

import "time"

type Wishlist struct {
	ID        int64     `db:"id"`
	UserID    int64     `db:"user_id"`
	CreatedAt time.Time `db:"created_at"`
	UpdatedAt time.Time `db:"updated_at"`
}

type WishlistItem struct {
	ID               int64     `db:"id"`
	WishlistID       int64     `db:"wishlist_id"`
	ProductVariantID int64     `db:"product_variant_id"`
	CreatedAt        time.Time `db:"created_at"`
	UpdatedAt        time.Time `db:"updated_at"`
}

type AddWishlistItemReq struct {
	ProductVariantID int64 `json:"product_variant_id" validate:"required,min=1"`
}

type WishlistItemResponse struct {
	ID             int64                 `json:"id"`
	ProductID      int64                 `json:"product_id"`
	ProductSlug    *string               `json:"product_slug,omitempty"`
	ProductTitle   string                `json:"product_title"`
	VariantID      int64                 `json:"variant_id"`
	SKU            *string               `json:"sku,omitempty"`
	Price          float64               `json:"price"`
	CompareAtPrice *float64              `json:"compare_at_price,omitempty"`
	ImageURL       *string               `json:"image_url,omitempty"`
	Options        []OptionValueResponse `json:"options,omitempty"`
	IsInStock      bool                  `json:"is_in_stock"`
	AddedAt        time.Time             `json:"added_at"`
}

type WishlistResponse struct {
	ID    int64                  `json:"id"`
	Items []WishlistItemResponse `json:"items"`
	Total int                    `json:"total"`
}
