package models

import "time"

// ── Entity ────────────────────────────────────────────────────────────────────

// HeroSlide is one editorial slide in the storefront home carousel. Slides are
// admin-managed; the public API serves only active rows within their optional
// scheduling window, ordered by SortOrder.
type HeroSlide struct {
	ID       int64   `json:"id"`
	Eyebrow  *string `json:"eyebrow"`
	Title    string  `json:"title"`
	Subtitle *string `json:"subtitle"`
	Badge    *string `json:"badge"`

	ImageURL       string  `json:"image_url"`
	MobileImageURL *string `json:"mobile_image_url"`
	ImageAlt       *string `json:"image_alt"`

	CTALabel          *string `json:"cta_label"`
	CTAHref           *string `json:"cta_href"`
	SecondaryCTALabel *string `json:"secondary_cta_label"`
	SecondaryCTAHref  *string `json:"secondary_cta_href"`

	Theme     string `json:"theme"`
	SortOrder int    `json:"sort_order"`
	IsActive  bool   `json:"is_active"`

	StartsAt *time.Time `json:"starts_at"`
	EndsAt   *time.Time `json:"ends_at"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// ── Requests ──────────────────────────────────────────────────────────────────

type HeroSlideReq struct {
	Eyebrow  *string `json:"eyebrow" validate:"omitempty,max=120"`
	Title    string  `json:"title" validate:"required,max=255"`
	Subtitle *string `json:"subtitle"`
	Badge    *string `json:"badge" validate:"omitempty,max=120"`

	ImageURL       string  `json:"image_url" validate:"required,max=2048"`
	MobileImageURL *string `json:"mobile_image_url" validate:"omitempty,max=2048"`
	ImageAlt       *string `json:"image_alt" validate:"omitempty,max=255"`

	CTALabel          *string `json:"cta_label" validate:"omitempty,max=120"`
	CTAHref           *string `json:"cta_href" validate:"omitempty,max=255"`
	SecondaryCTALabel *string `json:"secondary_cta_label" validate:"omitempty,max=120"`
	SecondaryCTAHref  *string `json:"secondary_cta_href" validate:"omitempty,max=255"`

	Theme     *string `json:"theme" validate:"omitempty,oneof=light dark"`
	SortOrder *int    `json:"sort_order"`
	IsActive  *bool   `json:"is_active"`

	StartsAt *time.Time `json:"starts_at"`
	EndsAt   *time.Time `json:"ends_at"`
}

type HeroSlideUpdateReq struct {
	Eyebrow  *string `json:"eyebrow" validate:"omitempty,max=120"`
	Title    *string `json:"title" validate:"omitempty,max=255"`
	Subtitle *string `json:"subtitle"`
	Badge    *string `json:"badge" validate:"omitempty,max=120"`

	ImageURL       *string `json:"image_url" validate:"omitempty,max=2048"`
	MobileImageURL *string `json:"mobile_image_url" validate:"omitempty,max=2048"`
	ImageAlt       *string `json:"image_alt" validate:"omitempty,max=255"`

	CTALabel          *string `json:"cta_label" validate:"omitempty,max=120"`
	CTAHref           *string `json:"cta_href" validate:"omitempty,max=255"`
	SecondaryCTALabel *string `json:"secondary_cta_label" validate:"omitempty,max=120"`
	SecondaryCTAHref  *string `json:"secondary_cta_href" validate:"omitempty,max=255"`

	Theme     *string `json:"theme" validate:"omitempty,oneof=light dark"`
	SortOrder *int    `json:"sort_order"`
	IsActive  *bool   `json:"is_active"`

	StartsAt *time.Time `json:"starts_at"`
	EndsAt   *time.Time `json:"ends_at"`
}

// ── Response ──────────────────────────────────────────────────────────────────

type HeroSlideResponse struct {
	ID       int64   `json:"id"`
	Eyebrow  *string `json:"eyebrow"`
	Title    string  `json:"title"`
	Subtitle *string `json:"subtitle"`
	Badge    *string `json:"badge"`

	ImageURL       string  `json:"image_url"`
	MobileImageURL *string `json:"mobile_image_url"`
	ImageAlt       *string `json:"image_alt"`

	CTALabel          *string `json:"cta_label"`
	CTAHref           *string `json:"cta_href"`
	SecondaryCTALabel *string `json:"secondary_cta_label"`
	SecondaryCTAHref  *string `json:"secondary_cta_href"`

	Theme     string `json:"theme"`
	SortOrder int    `json:"sort_order"`
	IsActive  bool   `json:"is_active"`

	StartsAt *time.Time `json:"starts_at"`
	EndsAt   *time.Time `json:"ends_at"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
