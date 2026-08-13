package tag

import (
	"time"

	"github.com/tiredbooy/internal/models"
)

// ─────────────────────────────────────────────────────────────
// Core DB Model
// ─────────────────────────────────────────────────────────────

type Tag struct {
	ID    int64  `db:"id"          json:"id"`
	Title string `db:"title"       json:"title"`
	// Product projections intentionally omit slug and use pgx's strict mapper;
	// direct tag queries scan this field explicitly.
	Slug        string    `db:"-"           json:"slug"`
	Description *string   `db:"description" json:"description,omitempty"`
	CreatedAt   time.Time `db:"created_at"  json:"created_at"`
	UpdatedAt   time.Time `db:"updated_at"  json:"updated_at"`
}

// ─────────────────────────────────────────────────────────────
// Requests
// ─────────────────────────────────────────────────────────────

type CreateTagReq struct {
	Title       string  `json:"title"       validate:"required,max=255"`
	Slug        string  `json:"slug"        validate:"omitempty,max=255"`
	Description *string `json:"description"`
}

type UpdateTagReq struct {
	Title       *string                      `json:"title"       validate:"omitempty,min=1,max=255"`
	Slug        *string                      `json:"slug"        validate:"omitempty,min=1,max=255"`
	Description models.NullablePatch[string] `json:"description"`
}

// ─────────────────────────────────────────────────────────────
// Filters
// ─────────────────────────────────────────────────────────────

type TagFilter struct {
	models.BaseFilter
}

func (f *TagFilter) Defaults() {
	f.BaseFilter.Defaults("created_at")
}
