// internal/models/category.go
package models

import "time"

// ─────────────────────────────────────────────────────────────
// Core DB Model
// ─────────────────────────────────────────────────────────────

type Category struct {
	ID          int64     `db:"id"`
	Name        string    `db:"name"`
	Description *string   `db:"description"`
	ParentID    *int64    `db:"parent_id"`
	Slug        *string   `db:"slug"`
	CreatedAt   time.Time `db:"created_at"`
	UpdatedAt   time.Time `db:"updated_at"`
}

// ─────────────────────────────────────────────────────────────
// Requests
// ─────────────────────────────────────────────────────────────

type CreateCategoryReq struct {
	Name        string  `json:"name"        validate:"required,max=255"`
	Description *string `json:"description"`
	ParentID    *int64  `json:"parent_id"   validate:"omitempty,min=1"`
	Slug        *string `json:"slug"        validate:"omitempty,max=255"`
}

type UpdateCategoryReq struct {
	Name        *string `json:"name"        validate:"omitempty,max=255"`
	Description *string `json:"description"`
	ParentID    *int64  `json:"parent_id"   validate:"omitempty,min=1"`
	Slug        *string `json:"slug"        validate:"omitempty,max=255"`
}

// ─────────────────────────────────────────────────────────────
// Responses
// ─────────────────────────────────────────────────────────────

type CategoryResponse struct {
	ID          int64   `json:"id"`
	Name        string  `json:"name"`
	Description *string `json:"description,omitempty"`
	ParentID    *int64  `json:"parent_id,omitempty"`
	Slug        *string `json:"slug,omitempty"`
}

type CategoryTree struct {
	ID          int64           `json:"id"`
	Name        string          `json:"name"`
	Description *string         `json:"description,omitempty"`
	Slug        *string         `json:"slug,omitempty"`
	Children    []*CategoryTree `json:"children,omitempty"`
}

// ─────────────────────────────────────────────────────────────
// Filters
// ─────────────────────────────────────────────────────────────

type CategoryFilter struct {
	BaseFilter
	ParentID *int64 `query:"parent_id"`
}

func (f *CategoryFilter) Defaults() {
	f.BaseFilter.Defaults("created_at")
}
