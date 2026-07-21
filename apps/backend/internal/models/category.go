// internal/models/category.go
package models

import "time"

// ─────────────────────────────────────────────────────────────
// Core DB Model
// ─────────────────────────────────────────────────────────────

type Category struct {
	ID           int64     `db:"id"`
	Title        string    `db:"title"`
	Description  *string   `db:"description"`
	ParentID     *int64    `db:"parent_id"`
	Slug         *string   `db:"slug"`
	ImageURL     *string   `db:"image_url"`
	IsFeatured   bool      `db:"is_featured"`
	CardSize     string    `db:"card_size"`
	DisplayOrder int16     `db:"display_order"`
	CreatedAt    time.Time `db:"created_at"`
	UpdatedAt    time.Time `db:"updated_at"`
}

// ─────────────────────────────────────────────────────────────
// Requests
// ─────────────────────────────────────────────────────────────

type CreateCategoryReq struct {
	Title       string  `json:"title"        validate:"required,max=255"`
	Description *string `json:"description"`
	ParentID    *int64  `json:"parent_id"    validate:"omitempty,min=1"`
	Slug        *string `json:"slug"         validate:"omitempty,max=255"`
	// TODO: re-enable `url` validation once the image upload API exists.
	// Local/relative paths like "/images/whiskey.jpg" fail `url` since it
	// requires an absolute URL with a scheme (https://...).
	// ImageURL     *string `json:"image_url"    validate:"omitempty,url"`
	ImageURL     *string `json:"image_url"`
	IsFeatured   *bool   `json:"is_featured"`
	CardSize     *string `json:"card_size"    validate:"omitempty,oneof=small large"`
	DisplayOrder *int16  `json:"display_order" validate:"omitempty,min=0"`
}

type UpdateCategoryReq struct {
	Title       *string               `json:"title" validate:"omitempty,max=255"`
	Description NullablePatch[string] `json:"description"`
	ParentID    NullablePatch[int64]  `json:"parent_id"`
	Slug        NullablePatch[string] `json:"slug"`
	// TODO: re-enable `url` validation once the image upload API exists.
	// ImageURL     *string `json:"image_url"    validate:"omitempty,url"`
	ImageURL     NullablePatch[string] `json:"image_url"`
	IsFeatured   *bool                 `json:"is_featured"`
	CardSize     *string               `json:"card_size"    validate:"omitempty,oneof=small large"`
	DisplayOrder *int16                `json:"display_order" validate:"omitempty,min=0"`
}

// ─────────────────────────────────────────────────────────────
// Responses
// ─────────────────────────────────────────────────────────────

type CategoryResponse struct {
	ID           int64   `json:"id"`
	Title        string  `json:"title"`
	Description  *string `json:"description,omitempty"`
	ParentID     *int64  `json:"parent_id,omitempty"`
	Slug         *string `json:"slug,omitempty"`
	ImageURL     *string `json:"image_url,omitempty"`
	IsFeatured   bool    `json:"is_featured"`
	CardSize     string  `json:"card_size,omitempty"`
	DisplayOrder int16   `json:"display_order"`
}

type CategoryTree struct {
	ID          int64           `json:"id"`
	Title       string          `json:"title"`
	Description *string         `json:"description,omitempty"`
	Slug        *string         `json:"slug,omitempty"`
	ImageURL    *string         `json:"image_url,omitempty"`
	Children    []*CategoryTree `json:"children,omitempty"`
}

type ProductCategoryResponse struct {
	ID    int64   `json:"id"`
	Title string  `json:"title"`
	Slug  *string `json:"slug"`
}

// ─────────────────────────────────────────────────────────────
// Filters
// ─────────────────────────────────────────────────────────────

type CategoryFilter struct {
	BaseFilter
	ParentID   *int64 `query:"parent_id"`
	IsFeatured *bool  `query:"is_featured"`
}

func (f *CategoryFilter) Defaults() {
	f.BaseFilter.Defaults("created_at")
}
