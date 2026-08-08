// internal/models/brand.go
package models

import "time"

// ─────────────────────────────────────────────────────────────
// Core DB Model
// ─────────────────────────────────────────────────────────────

type Brand struct {
	ID          int64     `db:"id"           json:"id"`
	Title       string    `db:"title"        json:"title"`
	Slug        string    `db:"slug"         json:"slug"`
	Country     *string   `db:"country"      json:"country,omitempty"`
	FoundedYear *int      `db:"founded_year" json:"founded_year,omitempty"`
	ImageURL    *string   `db:"image_url"    json:"image_url,omitempty"`
	Description *string   `db:"description"  json:"description,omitempty"`
	CreatedAt   time.Time `db:"created_at"   json:"created_at"`
	UpdatedAt   time.Time `db:"updated_at"   json:"updated_at"`
}

// ─────────────────────────────────────────────────────────────
// Requests
// ─────────────────────────────────────────────────────────────

type CreateBrandReq struct {
	Title       string  `json:"title"        validate:"required,max=255"`
	Slug        *string `json:"slug"         validate:"omitempty,max=255"`
	Country     *string `json:"country"      validate:"omitempty,max=80"`
	FoundedYear *int    `json:"founded_year" validate:"omitempty,min=1000"`
	ImageURL    *string `json:"image_url"    validate:"omitempty,url"`
	Description *string `json:"description"`
}

type UpdateBrandReq struct {
	Title       *string `json:"title"        validate:"omitempty,max=255"`
	Slug        *string `json:"slug"         validate:"omitempty,max=255"`
	Country     *string `json:"country"      validate:"omitempty,max=80"`
	FoundedYear *int    `json:"founded_year" validate:"omitempty,min=1000"`
	ImageURL    *string `json:"image_url"    validate:"omitempty,url"`
	Description *string `json:"description"`
}

// ─────────────────────────────────────────────────────────────
// Filters
// ─────────────────────────────────────────────────────────────

type BrandFilter struct {
	BaseFilter
	Country     *string `query:"country"`
	FoundedFrom *int    `query:"founded_from"`
	FoundedTo   *int    `query:"founded_to"`
}

func (f *BrandFilter) Defaults() {
	f.BaseFilter.Defaults("created_at")
}
