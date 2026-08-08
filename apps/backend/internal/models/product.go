package models

import "time"

// ─────────────────────────────────────────────────────────────
// Core DB Models
// ─────────────────────────────────────────────────────────────

type Product struct {
	ID              int64     `db:"id"`
	Title           string    `db:"title"`
	Code            *string   `db:"code"`
	Slug            *string   `db:"slug"`
	CategoryID      *int64    `db:"category_id"`
	Description     *string   `db:"description"`
	BrandID         *int64    `db:"brand_id"`
	CountryOfOrigin *string   `db:"country_of_origin"`
	ABV             *float64  `db:"abv"`
	Weight          *float64  `db:"weight"`
	IsActive        bool      `db:"is_active"`
	MetaTitle       *string   `db:"meta_title"`
	MetaDescription *string   `db:"meta_description"`
	MetaTags        []string  `db:"meta_tags"`
	CreatedAt       time.Time `db:"created_at"`
	UpdatedAt       time.Time `db:"updated_at"`
}

type ProductImage struct {
	ID               int64     `db:"id"`
	ProductID        *int64    `db:"product_id"`
	ProductVariantID *int64    `db:"product_variant_id"`
	ImageURL         string    `db:"image_url"`
	StorageKey       *string   `db:"storage_key"`
	AltText          *string   `db:"alt_text"`
	SortOrder        int       `db:"sort_order"`
	IsPrimary        bool      `db:"is_primary"`
	Width            *int      `db:"width"`
	Height           *int      `db:"height"`
	CreatedAt        time.Time `db:"created_at"`
	UpdatedAt        time.Time `db:"updated_at"`
}

// ─────────────────────────────────────────────────────────────
// Responses
// ─────────────────────────────────────────────────────────────

// type ProductRes

// ─────────────────────────────────────────────────────────────
// Requests
// ─────────────────────────────────────────────────────────────

type CreateProductReq struct {
	Title           string             `json:"title"             validate:"required,max=255"`
	Code            *string            `json:"code"              validate:"omitempty,max=80"`
	Slug            *string            `json:"slug"              validate:"omitempty"`
	CategoryID      *int64             `json:"category_id"       validate:"omitempty,min=1"`
	Description     *string            `json:"description"`
	BrandID         *int64             `json:"brand_id"          validate:"omitempty,min=1"`
	CountryOfOrigin *string            `json:"country_of_origin" validate:"omitempty,max=100"`
	ABV             *float64           `json:"abv"               validate:"omitempty,min=0,max=100"`
	Weight          *float64           `json:"weight"            validate:"omitempty,min=0"`
	MetaTitle       *string            `json:"meta_title"        validate:"omitempty,max=225"`
	MetaDescription *string            `json:"meta_description"`
	MetaTags        []string           `json:"meta_tags"`
	TagIDs          []int64            `json:"tag_ids"`                  // junction — handled in service
	Variants        []CreateVariantReq `json:"variants" validate:"dive"` // created together with product
}

type UpdateProductReq struct {
	Title           *string  `json:"title"             validate:"omitempty,max=255"`
	Code            *string  `json:"code"              validate:"omitempty,max=80"`
	Slug            *string  `json:"slug"              validate:"omitempty"`
	CategoryID      *int64   `json:"category_id"       validate:"omitempty,min=1"`
	Description     *string  `json:"description"`
	BrandID         *int64   `json:"brand_id"          validate:"omitempty,min=1"`
	CountryOfOrigin *string  `json:"country_of_origin" validate:"omitempty,max=100"`
	ABV             *float64 `json:"abv"               validate:"omitempty,min=0,max=100"`
	Weight          *float64 `json:"weight"            validate:"omitempty,min=0"`
	IsActive        *bool    `json:"is_active"`
	MetaTitle       *string  `json:"meta_title"        validate:"omitempty,max=225"`
	MetaDescription *string  `json:"meta_description"`
	MetaTags        []string `json:"meta_tags"`
	TagIDs          []int64  `json:"tag_ids"`
}

// ─────────────────────────────────────────────────────────────
// Filters
// ─────────────────────────────────────────────────────────────

type ProductFilter struct {
	BaseFilter
	CategoryID         *int64   `query:"category_id"`
	IncludeDescendants bool     `query:"include_descendants"`
	BrandID            *int64   `query:"brand_id"`
	BrandSlug          *string  `query:"brand" validate:"omitempty,max=255"`
	TagID              *int64   `query:"tag_id"`
	IsActive           *bool    `query:"is_active"`
	MinPrice           *float64 `query:"min_price"`
	MaxPrice           *float64 `query:"max_price"`
}

func (f *ProductFilter) Defaults() {
	f.BaseFilter.Defaults("created_at")
}
