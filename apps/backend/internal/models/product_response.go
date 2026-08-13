package models

import "time"

// ─────────────────────────────────────────────────────────────
// Responses
// ─────────────────────────────────────────────────────────────

// ProductListItem — lightweight, used in paginated list
type ProductListItem struct {
	ID       int64          `json:"id"`
	Title    string         `json:"title"`
	Code     *string        `json:"code,omitempty"`
	Slug     *string        `json:"slug,omitempty"`
	Image    *ImageResponse `json:"image_response"`
	Brand    *string        `json:"brand,omitempty"` // brand title, joined
	Category *string        `json:"category,omitempty"`
	Tags     []TagResponse  `json:"tags,omitempty"`
	IsActive bool           `json:"is_active"`
	// Weight is unit package weight in kilograms (same column as product detail).
	// Omitted when unset so admin UIs can flag shippable SKUs missing weight.
	Weight                *float64 `json:"weight,omitempty"`
	MinPrice              float64  `json:"min_price"` // cheapest active variant
	MaxPrice              float64  `json:"max_price"` // most expensive active variant
	ActiveVariantCount    int      `json:"active_variant_count"`
	AvailableVariantCount int      `json:"available_variant_count"`
	// AvailableStock is sellable stock summed across active variants.
	AvailableStock       int64  `json:"available_stock"`
	PurchasableVariantID *int64 `json:"purchasable_variant_id,omitempty"`
}

// ProductDetail — full response for GET /products/:id
type ProductDetail struct {
	ID              int64             `json:"id"`
	Title           string            `json:"title"`
	Code            *string           `json:"code,omitempty"`
	Slug            *string           `json:"slug,omitempty"`
	CategoryID      *int64            `json:"category_id,omitempty"`
	Description     *string           `json:"description,omitempty"`
	BrandID         *int64            `json:"brand_id,omitempty"`
	CountryOfOrigin *string           `json:"country_of_origin,omitempty"`
	ABV             *float64          `json:"abv,omitempty"`
	Weight          *float64          `json:"weight,omitempty"`
	IsActive        bool              `json:"is_active"`
	MetaTitle       *string           `json:"meta_title,omitempty"`
	MetaDescription *string           `json:"meta_description,omitempty"`
	MetaTags        []string          `json:"meta_tags,omitempty"`
	UpdatedAt       time.Time         `json:"updated_at"`
	Tags            []TagResponse     `json:"tags,omitempty"`
	Images          []ImageResponse   `json:"images"`
	Variants        []VariantResponse `json:"variants"`
}

type TagResponse struct {
	ID    int64  `json:"id"`
	Title string `json:"title"`
}

type ImageResponse struct {
	ID         int64   `json:"id"`
	ImageURL   string  `json:"image_url"`             // canonical serving URL (/media/{key} for uploads)
	StorageKey *string `json:"storage_key,omitempty"` // backend key; build transforms as /media/{key}?f=&q=&w=
	AltText    *string `json:"alt_text,omitempty"`
	SortOrder  int     `json:"sort_order"`
	IsPrimary  bool    `json:"is_primary"`
	Width      *int    `json:"width,omitempty"`
	Height     *int    `json:"height,omitempty"`
}

type VariantResponse struct {
	ID             int64                 `json:"id"`
	SKU            *string               `json:"sku,omitempty"`
	Price          float64               `json:"price"`
	CompareAtPrice *float64              `json:"compare_at_price,omitempty"`
	IsActive       bool                  `json:"is_active"`
	AvailableStock *int                  `json:"available_stock,omitempty"`
	Options        []OptionValueResponse `json:"options"`
	Images         []ImageResponse       `json:"images"`
}

type OptionValueResponse struct {
	ID              int64  `json:"id"`
	OptionTypeID    int64  `json:"option_type_id"`
	OptionTypeTitle string `json:"option_type_title"` // stable administrative name
	OptionType      string `json:"option_type"`       // customer-facing label, e.g. "Color"
	Value           string `json:"value"`             // e.g. "Red"
}

// MeiliProduct — flat document shape for the Meilisearch products index (PH-030b).
// Display fields keep original text; *_search fields use pkg/searchtext.Normalize
// so Persian confusables match the live Postgres ILIKE path (PH-030a).
// Inventory/availability is intentionally absent — hydrate from Postgres on cutover.
type MeiliProduct struct {
	ID    int64   `json:"id"`
	Title string  `json:"title"`
	Code  *string `json:"code,omitempty"`
	Slug  *string `json:"slug,omitempty"`
	// Description is optional long text; may be large — still indexed for discovery.
	Description   *string  `json:"description,omitempty"`
	BrandID       *int64   `json:"brand_id,omitempty"`
	BrandTitle    *string  `json:"brand_title,omitempty"`
	CategoryID    *int64   `json:"category_id,omitempty"`
	CategoryTitle *string  `json:"category_title,omitempty"`
	Tags          []string `json:"tags,omitempty"` // tag titles
	MetaTags      []string `json:"meta_tags,omitempty"`
	MinPrice      float64  `json:"min_price"`
	MaxPrice      float64  `json:"max_price"`
	IsActive      bool     `json:"is_active"`
	CountryOfOrigin *string `json:"country_of_origin,omitempty"`

	// Normalized search fields (primary searchableAttributes in Meili settings).
	TitleSearch       string `json:"title_search"`
	DescriptionSearch string `json:"description_search,omitempty"`
	BrandSearch       string `json:"brand_search,omitempty"`
	CategorySearch    string `json:"category_search,omitempty"`
}
