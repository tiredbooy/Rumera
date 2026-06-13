package models

import "time"

// ─────────────────────────────────────────────────────────────
// Core DB Model
// ─────────────────────────────────────────────────────────────

type Tag struct {
	ID          int64     `db:"id"          json:"id"`
	Title       string    `db:"title"       json:"title"`
	Description *string   `db:"description" json:"description,omitempty"`
	CreatedAt   time.Time `db:"created_at"  json:"created_at"`
	UpdatedAt   time.Time `db:"updated_at"  json:"updated_at"`
}

// ─────────────────────────────────────────────────────────────
// Requests
// ─────────────────────────────────────────────────────────────

type CreateTagReq struct {
	Title       string  `json:"title"       validate:"required,max=255"`
	Description *string `json:"description"`
}

type UpdateTagReq struct {
	Title       *string `json:"title"       validate:"omitempty,max=255"`
	Description *string `json:"description"`
}

// ─────────────────────────────────────────────────────────────
// Filters
// ─────────────────────────────────────────────────────────────

type TagFilter struct {
	BaseFilter
}

func (f *TagFilter) Defaults() {
	f.BaseFilter.Defaults("created_at")
}
