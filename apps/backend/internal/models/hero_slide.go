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

	ImageURL       *string `json:"image_url"`
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
	Eyebrow  *string `json:"eyebrow"`
	Title    string  `json:"title"`
	Subtitle *string `json:"subtitle"`
	Badge    *string `json:"badge"`

	ImageURL       *string `json:"image_url"`
	MobileImageURL *string `json:"mobile_image_url"`
	ImageAlt       *string `json:"image_alt"`

	CTALabel          *string `json:"cta_label"`
	CTAHref           *string `json:"cta_href"`
	SecondaryCTALabel *string `json:"secondary_cta_label"`
	SecondaryCTAHref  *string `json:"secondary_cta_href"`

	Theme     *string `json:"theme"`
	SortOrder *int    `json:"sort_order"`
	IsActive  *bool   `json:"is_active"`

	StartsAt *time.Time `json:"starts_at"`
	EndsAt   *time.Time `json:"ends_at"`
}

type HeroSlideUpdateReq struct {
	Eyebrow  NullablePatch[string] `json:"eyebrow"`
	Title    *string               `json:"title"`
	Subtitle NullablePatch[string] `json:"subtitle"`
	Badge    NullablePatch[string] `json:"badge"`

	ImageURL               NullablePatch[string] `json:"image_url"`
	MobileImageURL         NullablePatch[string] `json:"mobile_image_url"`
	ImageAlt               NullablePatch[string] `json:"image_alt"`
	ExpectedImageURL       NullablePatch[string] `json:"-"`
	ExpectedMobileImageURL NullablePatch[string] `json:"-"`

	CTALabel          NullablePatch[string] `json:"cta_label"`
	CTAHref           NullablePatch[string] `json:"cta_href"`
	SecondaryCTALabel NullablePatch[string] `json:"secondary_cta_label"`
	SecondaryCTAHref  NullablePatch[string] `json:"secondary_cta_href"`

	Theme     *string `json:"theme"`
	SortOrder *int    `json:"sort_order"`
	IsActive  *bool   `json:"is_active"`

	StartsAt NullablePatch[time.Time] `json:"starts_at"`
	EndsAt   NullablePatch[time.Time] `json:"ends_at"`
}

// ── Responses ─────────────────────────────────────────────────────────────────

// PublicHeroSlideResponse is the storefront carousel projection. Activation,
// scheduling, and audit fields remain admin-only; list order is represented by
// SortOrder and guaranteed by the repository query.
type PublicHeroSlideResponse struct {
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
}

// AdminHeroSlideResponse is the complete projection used by admin list, detail,
// create, and update responses.
type AdminHeroSlideResponse struct {
	ID       int64   `json:"id"`
	Eyebrow  *string `json:"eyebrow"`
	Title    string  `json:"title"`
	Subtitle *string `json:"subtitle"`
	Badge    *string `json:"badge"`

	ImageURL       *string `json:"image_url"`
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
