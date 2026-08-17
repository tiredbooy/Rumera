package product

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	catvariant "github.com/tiredbooy/internal/features/catalog/variant"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/apperr"
)

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

// ─────────────────────────────────────────────────────────────
// Responses
// ─────────────────────────────────────────────────────────────

// type ProductRes

// ─────────────────────────────────────────────────────────────
// Requests
// ─────────────────────────────────────────────────────────────

type CreateProductReq struct {
	Title           string                        `json:"title"             validate:"required,max=255"`
	Code            *string                       `json:"code"              validate:"omitempty,max=80"`
	Slug            *string                       `json:"slug"              validate:"omitempty"`
	CategoryID      *int64                        `json:"category_id"       validate:"omitempty,min=1"`
	Description     *string                       `json:"description"`
	BrandID         *int64                        `json:"brand_id"          validate:"omitempty,min=1"`
	CountryOfOrigin *string                       `json:"country_of_origin" validate:"omitempty,max=100"`
	ABV             *float64                      `json:"abv"               validate:"omitempty,min=0,max=100"`
	Weight          *float64                      `json:"weight"            validate:"omitempty,min=0"`
	MetaTitle       *string                       `json:"meta_title"        validate:"omitempty,max=225"`
	MetaDescription *string                       `json:"meta_description"`
	MetaTags        []string                      `json:"meta_tags"`
	TagIDs          []int64                       `json:"tag_ids"`                  // junction — handled in service
	Variants        []catvariant.CreateVariantReq `json:"variants" validate:"dive"` // created together with product
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
	models.BaseFilter
	CategoryID         *int64   `query:"category_id"`
	IncludeDescendants bool     `query:"include_descendants"`
	BrandID            *int64   `query:"brand_id"`
	BrandSlug          *string  `query:"brand" validate:"omitempty,max=255"`
	TagID              *int64   `query:"tag_id"`
	IsActive           *bool    `query:"is_active"`
	MinPrice           *float64 `query:"min_price"`
	MaxPrice           *float64 `query:"max_price"`
	// IDs restricts the list to specific products, comma-separated (CF-2).
	//
	// A picker that saved a scope of product ids has no way to label them again:
	// nothing in the API returns products by id in one call, and the coupon
	// response carries bare integers. Without this, an existing scope pointing
	// outside the first page is invisible in the UI while staying live in the
	// backend — the operator sees an empty selection over a discount that is
	// really applied.
	//
	// A string, not a slice: the query binder decodes no slice kinds
	// (httpx/bind.go setField), which is why `statuses` on orders is spelled the
	// same way.
	IDs string `query:"ids"`
}

// maxFilterIDs matches the pagination ceiling — a caller wanting more than a
// page of products by id should be paging, not widening this.
const maxFilterIDs = 100

// ValidIDs parses the IDs filter, rejecting anything non-numeric so a typo is a
// 400 rather than a silently empty result set that reads as "no such products".
func (f *ProductFilter) ValidIDs() ([]int64, error) {
	if strings.TrimSpace(f.IDs) == "" {
		return nil, nil
	}
	seen := map[int64]struct{}{}
	out := make([]int64, 0, maxFilterIDs)
	for _, raw := range strings.Split(f.IDs, ",") {
		part := strings.TrimSpace(raw)
		if part == "" {
			continue
		}
		id, err := strconv.ParseInt(part, 10, 64)
		if err != nil || id <= 0 {
			return nil, fmt.Errorf("%w: invalid product id %q", apperr.ErrInvalidRequest, part)
		}
		if _, dup := seen[id]; dup {
			continue
		}
		if len(out) >= maxFilterIDs {
			return nil, fmt.Errorf("%w: at most %d ids", apperr.ErrInvalidRequest, maxFilterIDs)
		}
		seen[id] = struct{}{}
		out = append(out, id)
	}
	return out, nil
}

func (f *ProductFilter) Defaults() {
	f.BaseFilter.Defaults("created_at")
}
