package models

// ─────────────────────────────────────────────────────────────
// Responses
// ─────────────────────────────────────────────────────────────

// ProductListItem — lightweight, used in paginated list
type ProductListItem struct {
	ID                    int64          `json:"id"`
	Title                 string         `json:"title"`
	Code                  *string        `json:"code,omitempty"`
	Slug                  *string        `json:"slug,omitempty"`
	Image                 *ImageResponse `json:"image_response"`
	Brand                 *string        `json:"brand,omitempty"` // brand title, joined
	Category              *string        `json:"category,omitempty"`
	IsActive              bool           `json:"is_active"`
	MinPrice              float64        `json:"min_price"` // cheapest active variant
	MaxPrice              float64        `json:"max_price"` // most expensive active variant
	ActiveVariantCount    int            `json:"active_variant_count"`
	AvailableVariantCount int            `json:"available_variant_count"`
	PurchasableVariantID  *int64         `json:"purchasable_variant_id,omitempty"`
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
	Tags            []TagResponse     `json:"tags,omitempty"`
	Images          []ImageResponse   `json:"images,omitempty"`
	Variants        []VariantResponse `json:"variants,omitempty"`
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
	Options        []OptionValueResponse `json:"options,omitempty"`
	Images         []ImageResponse       `json:"images,omitempty"`
}

type OptionValueResponse struct {
	ID         int64  `json:"id"`
	OptionType string `json:"option_type"` // e.g. "Color"
	Value      string `json:"value"`       // e.g. "Red"
}

// MeiliProduct — the document shape indexed in MeiliSearch.
// Keep it flat and search-friendly — no nested objects.
type MeiliProduct struct {
	ID              int64    `json:"id"`
	Title           string   `json:"title"`
	Code            *string  `json:"code"`
	Slug            *string  `json:"slug"`
	Description     *string  `json:"description"`
	BrandID         *int64   `json:"brand_id"`
	CategoryID      *int64   `json:"category_id"`
	Tags            []string `json:"tags"` // tag titles for full-text search
	MetaTags        []string `json:"meta_tags"`
	MinPrice        float64  `json:"min_price"`
	MaxPrice        float64  `json:"max_price"`
	IsActive        bool     `json:"is_active"`
	CountryOfOrigin *string  `json:"country_of_origin"`
}
