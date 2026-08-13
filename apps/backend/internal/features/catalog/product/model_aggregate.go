package product

import "time"

// SaveProductAggregateReq is the authoritative admin editor snapshot. Nullable
// pointers are values, not PATCH presence markers: nil intentionally clears the
// corresponding column on update.
type SaveProductAggregateReq struct {
	OperationID       string                  `json:"operation_id" validate:"required,uuid4"`
	ExpectedUpdatedAt *time.Time              `json:"expected_updated_at"`
	Title             string                  `json:"title" validate:"required,max=255"`
	Code              *string                 `json:"code" validate:"omitempty,max=80"`
	Slug              *string                 `json:"slug"`
	CategoryID        *int64                  `json:"category_id" validate:"omitempty,min=1"`
	Description       *string                 `json:"description"`
	BrandID           *int64                  `json:"brand_id" validate:"omitempty,min=1"`
	CountryOfOrigin   *string                 `json:"country_of_origin" validate:"omitempty,max=100"`
	ABV               *float64                `json:"abv" validate:"omitempty,min=0,max=100"`
	Weight            *float64                `json:"weight" validate:"omitempty,min=0"`
	IsActive          bool                    `json:"is_active"`
	MetaTitle         *string                 `json:"meta_title" validate:"omitempty,max=225"`
	MetaDescription   *string                 `json:"meta_description"`
	MetaTags          []string                `json:"meta_tags"`
	TagIDs            []int64                 `json:"tag_ids"`
	Variants          []SaveProductVariantReq `json:"variants" validate:"dive"`
	Images            []SaveProductImageReq   `json:"images" validate:"dive"`
}

type SaveProductVariantReq struct {
	ID             *int64   `json:"id" validate:"omitempty,min=1"`
	SKU            *string  `json:"sku" validate:"omitempty,max=250"`
	Price          float64  `json:"price" validate:"required,gt=0"`
	CompareAtPrice *float64 `json:"compare_at_price" validate:"omitempty,min=0"`
	IsActive       bool     `json:"is_active"`
	OptionValueIDs []int64  `json:"option_value_ids"`
}

// SaveProductImageReq is one entry in the desired product-gallery order.
// Existing rows send ID only; new local uploads send StorageKey; new external
// images send ImageURL. The service resolves and validates new media before the
// repository transaction starts.
type SaveProductImageReq struct {
	ID         *int64  `json:"id" validate:"omitempty,min=1"`
	StorageKey *string `json:"storage_key" validate:"omitempty,max=512"`
	ImageURL   *string `json:"image_url" validate:"omitempty,max=2048"`
	AltText    *string `json:"alt_text" validate:"omitempty,max=255"`
	IsPrimary  bool    `json:"is_primary"`
	Width      *int    `json:"-"`
	Height     *int    `json:"-"`
}

type ProductAggregateWriteResult struct {
	Product      *Product
	DetachedKeys []string
	Replayed     bool
}

// FieldError preserves the request path for a repository-level conflict or
// invalid relationship so the service can return an actionable API error.
type FieldError struct {
	Field   string
	Message string
	Err     error
}

func (e *FieldError) Error() string {
	if e.Message != "" {
		return e.Message
	}
	return e.Err.Error()
}

func (e *FieldError) Unwrap() error { return e.Err }
