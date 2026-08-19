package recipes

import (
	"time"

	"github.com/shopspring/decimal"
	"github.com/tiredbooy/internal/models"
)

type RecipeDifficulty string

const (
	RecipeDifficultyEasy   RecipeDifficulty = "easy"
	RecipeDifficultyMedium RecipeDifficulty = "medium"
	RecipeDifficultyHard   RecipeDifficulty = "hard"
)

type RecipeStatus string

const (
	RecipeStatusDraft     RecipeStatus = "draft"
	RecipeStatusPublished RecipeStatus = "published"
	RecipeStatusArchived  RecipeStatus = "archived"
)

// ── Entities ──────────────────────────────────────────────────────────────────

type Recipe struct {
	ID          int64            `json:"id"`
	Title       string           `json:"title"`
	Slug        string           `json:"slug"`
	Excerpt     *string          `json:"excerpt"`
	Description *string          `json:"description"`
	Content     string           `json:"content"`
	Difficulty  RecipeDifficulty `json:"difficulty"`

	PrepTimeMinutes  int  `json:"prep_time_minutes"`
	CookTimeMinutes  int  `json:"cook_time_minutes"`
	TotalTimeMinutes int  `json:"total_time_minutes"` // generated: prep + cook
	Servings         int  `json:"servings"`
	Calories         *int `json:"calories"`

	CocktailType      *string `json:"cocktail_type"`
	GlassType         *string `json:"glass_type"`
	ServingSuggestion *string `json:"serving_suggestion"`

	ImageURL *string `json:"image_url"`
	ImageAlt *string `json:"image_alt"`

	// Publishing
	Status      RecipeStatus `json:"status"`
	IsFeatured  bool         `json:"is_featured"`
	PublishedAt *time.Time   `json:"published_at"`
	ViewCount   int64        `json:"view_count"`

	// SEO
	MetaTitle       *string  `json:"meta_title"`
	MetaDescription *string  `json:"meta_description"`
	MetaKeywords    []string `json:"meta_keywords"`
	CanonicalURL    *string  `json:"canonical_url"`
	OGImageURL      *string  `json:"og_image_url"`

	UserID    *int64    `json:"user_id"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type RecipeIngredient struct {
	ID               int64            `json:"id"`
	RecipeID         int64            `json:"recipe_id"`
	ProductVariantID *int64           `json:"product_variant_id"`
	IngredientName   string           `json:"ingredient_name"`
	Quantity         *decimal.Decimal `json:"quantity"`
	Unit             *string          `json:"unit"`
	Optional         bool             `json:"optional"`
	Notes            *string          `json:"notes"`
	SortOrder        int              `json:"sort_order"`
	CreatedAt        time.Time        `json:"created_at"`
	UpdatedAt        time.Time        `json:"updated_at"`
}

type RecipeProduct struct {
	ID               int64            `json:"id"`
	RecipeID         int64            `json:"recipe_id"`
	ProductVariantID int64            `json:"product_variant_id"`
	Quantity         *decimal.Decimal `json:"quantity"`
	Unit             *string          `json:"unit"`
	SortOrder        int              `json:"sort_order"`
	IsPrimary        bool             `json:"is_primary"`
	Role             *string          `json:"role"`
}

type RecipeTag struct {
	ID       int64 `json:"id"`
	RecipeID int64 `json:"recipe_id"`
	TagID    int64 `json:"tag_id"`
}

// ── Requests ──────────────────────────────────────────────────────────────────

type RecipeReq struct {
	Title       string           `json:"title"       validate:"required,max=255"`
	Slug        string           `json:"slug"        validate:"omitempty,max=255"`
	Excerpt     *string          `json:"excerpt"`
	Description *string          `json:"description"`
	Content     string           `json:"content"     validate:"required"`
	Difficulty  RecipeDifficulty `json:"difficulty"  validate:"omitempty,oneof=easy medium hard"`

	PrepTimeMinutes int  `json:"prep_time_minutes" validate:"omitempty,min=0"`
	CookTimeMinutes int  `json:"cook_time_minutes" validate:"omitempty,min=0"`
	Servings        int  `json:"servings"          validate:"omitempty,min=1"`
	Calories        *int `json:"calories"          validate:"omitempty,min=0"`

	CocktailType      *string `json:"cocktail_type"`
	GlassType         *string `json:"glass_type"`
	ServingSuggestion *string `json:"serving_suggestion"`

	ImageURL *string `json:"image_url" validate:"omitempty,max=2048"`
	ImageAlt *string `json:"image_alt" validate:"omitempty,max=255"`

	Status      RecipeStatus `json:"status"       validate:"omitempty,oneof=draft published archived"`
	IsFeatured  bool         `json:"is_featured"`
	PublishedAt *time.Time   `json:"published_at"`

	MetaTitle       *string  `json:"meta_title"        validate:"omitempty,max=255"`
	MetaDescription *string  `json:"meta_description"`
	MetaKeywords    []string `json:"meta_keywords"`
	CanonicalURL    *string  `json:"canonical_url"`
	OGImageURL      *string  `json:"og_image_url" validate:"omitempty,max=2048"`

	UserID *int64 `json:"user_id"`

	// Relations — applied transactionally with the recipe.
	Ingredients []*RecipeIngredientReq `json:"ingredients"`
	Products    []*RecipeProductReq    `json:"products"`
	TagIDs      []int64                `json:"tag_ids"`
}

type RecipeUpdateReq struct {
	Title       *string           `json:"title"       validate:"omitempty,max=255"`
	Slug        *string           `json:"slug"        validate:"omitempty,max=255"`
	Excerpt     *string           `json:"excerpt"`
	Description *string           `json:"description"`
	Content     *string           `json:"content"`
	Difficulty  *RecipeDifficulty `json:"difficulty"  validate:"omitempty,oneof=easy medium hard"`

	PrepTimeMinutes *int `json:"prep_time_minutes" validate:"omitempty,min=0"`
	CookTimeMinutes *int `json:"cook_time_minutes" validate:"omitempty,min=0"`
	Servings        *int `json:"servings"          validate:"omitempty,min=1"`
	Calories        *int `json:"calories"          validate:"omitempty,min=0"`

	CocktailType      *string `json:"cocktail_type"`
	GlassType         *string `json:"glass_type"`
	ServingSuggestion *string `json:"serving_suggestion"`

	ImageURL           models.NullablePatch[string] `json:"image_url"`
	ImageAlt           models.NullablePatch[string] `json:"image_alt"`
	ExpectedImageURL   models.NullablePatch[string] `json:"-"`
	ExpectedOGImageURL models.NullablePatch[string] `json:"-"`

	Status      *RecipeStatus `json:"status"       validate:"omitempty,oneof=draft published archived"`
	IsFeatured  *bool         `json:"is_featured"`
	PublishedAt *time.Time    `json:"published_at"`

	MetaTitle       *string                      `json:"meta_title"        validate:"omitempty,max=255"`
	MetaDescription *string                      `json:"meta_description"`
	MetaKeywords    []string                     `json:"meta_keywords"`
	CanonicalURL    *string                      `json:"canonical_url"`
	OGImageURL      models.NullablePatch[string] `json:"og_image_url"`

	// Relations — nil = leave untouched, non-nil (incl. empty) = replace.
	Ingredients []*RecipeIngredientReq `json:"ingredients"`
	Products    []*RecipeProductReq    `json:"products"`
	TagIDs      []int64                `json:"tag_ids"`
}

type RecipeIngredientReq struct {
	ProductVariantID *int64           `json:"product_variant_id"`
	IngredientName   string           `json:"ingredient_name" validate:"required,max=255"`
	Quantity         *decimal.Decimal `json:"quantity"`
	Unit             *string          `json:"unit"`
	Optional         bool             `json:"optional"`
	Notes            *string          `json:"notes"`
	SortOrder        *int             `json:"sort_order"`
}

type RecipeProductReq struct {
	ProductVariantID int64            `json:"product_variant_id" validate:"required,min=1"`
	Quantity         *decimal.Decimal `json:"quantity"`
	Unit             *string          `json:"unit"`
	SortOrder        *int             `json:"sort_order"`
	IsPrimary        bool             `json:"is_primary"`
	Role             *string          `json:"role"`
}

// ── Filters ───────────────────────────────────────────────────────────────────

type RecipeFilter struct {
	models.BaseFilter
	Status     *RecipeStatus     `query:"status"`
	Difficulty *RecipeDifficulty `query:"difficulty"`
	IsFeatured *bool             `query:"is_featured"`
	TagID      *int64            `query:"tag_id"`
	// VariantID filters to recipes that use a specific product variant (either as
	// a shoppable product or a linked ingredient).
	VariantID *int64 `query:"variant_id"`
	MaxTime   *int   `query:"max_time"` // total_time_minutes <= MaxTime
	// ExcludeID keeps a separately rendered featured recipe out of pagination.
	ExcludeID *int64 `query:"exclude_id"`
	// LiveOnly hides recipes whose published_at is still in the future. Public
	// list/featured/related set this; admin list does not.
	LiveOnly bool `query:"-"`
}

func (f *RecipeFilter) Defaults() {
	f.BaseFilter.Defaults("published_at")
}

// ── Responses ─────────────────────────────────────────────────────────────────

type RecipeResponse struct {
	ID          int64            `json:"id"`
	Title       string           `json:"title"`
	Slug        string           `json:"slug"`
	Excerpt     *string          `json:"excerpt"`
	Description *string          `json:"description"`
	Content     string           `json:"content"`
	Difficulty  RecipeDifficulty `json:"difficulty"`

	PrepTimeMinutes  int  `json:"prep_time_minutes"`
	CookTimeMinutes  int  `json:"cook_time_minutes"`
	TotalTimeMinutes int  `json:"total_time_minutes"`
	Servings         int  `json:"servings"`
	Calories         *int `json:"calories"`

	CocktailType      *string `json:"cocktail_type"`
	GlassType         *string `json:"glass_type"`
	ServingSuggestion *string `json:"serving_suggestion"`

	ImageURL *string `json:"image_url"`
	ImageAlt *string `json:"image_alt"`

	Status      RecipeStatus `json:"status"`
	IsFeatured  bool         `json:"is_featured"`
	PublishedAt *time.Time   `json:"published_at"`
	ViewCount   int64        `json:"view_count"`

	MetaTitle       *string  `json:"meta_title"`
	MetaDescription *string  `json:"meta_description"`
	MetaKeywords    []string `json:"meta_keywords"`
	CanonicalURL    *string  `json:"canonical_url"`
	OGImageURL      *string  `json:"og_image_url"`

	UserID    *int64    `json:"user_id"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// RecipeListItem — lightweight card for listings/carousels.
type RecipeListItem struct {
	ID               int64            `json:"id"`
	Title            string           `json:"title"`
	Slug             string           `json:"slug"`
	Excerpt          *string          `json:"excerpt"`
	Difficulty       RecipeDifficulty `json:"difficulty"`
	TotalTimeMinutes int              `json:"total_time_minutes"`
	Servings         int              `json:"servings"`
	ImageURL         *string          `json:"image_url"`
	ImageAlt         *string          `json:"image_alt"`
	CocktailType     *string          `json:"cocktail_type"`
	IsFeatured       bool             `json:"is_featured"`
	ViewCount        int64            `json:"view_count"`
	PublishedAt      *time.Time       `json:"published_at"`
}

// RecipeAdminListItem keeps the public card projection lightweight while adding
// the workflow fields the admin board needs to represent drafts and archives.
type RecipeAdminListItem struct {
	RecipeListItem
	Status    RecipeStatus `json:"status"`
	CreatedAt time.Time    `json:"created_at"`
	UpdatedAt time.Time    `json:"updated_at"`
}

type RecipeIngredientResponse struct {
	ID               int64   `json:"id"`
	ProductVariantID *int64  `json:"product_variant_id"`
	IngredientName   string  `json:"ingredient_name"`
	Quantity         *string `json:"quantity"`
	Unit             *string `json:"unit"`
	Optional         bool    `json:"optional"`
	Notes            *string `json:"notes"`
	SortOrder        int     `json:"sort_order"`
}

// ShoppableProduct is a recipe's linked product enriched with the live catalogue
// data the storefront needs to render an "Add to cart" upsell directly on the
// recipe page — the core sales driver of the feature.
type ShoppableProduct struct {
	RecipeProductID  int64            `json:"recipe_product_id"`
	ProductVariantID int64            `json:"product_variant_id"`
	ProductID        int64            `json:"product_id"`
	ProductTitle     string           `json:"product_title"`
	ProductSlug      *string          `json:"product_slug"`
	Brand            *string          `json:"brand,omitempty"`
	SKU              *string          `json:"sku,omitempty"`
	Price            float64          `json:"price"`
	CompareAtPrice   *float64         `json:"compare_at_price,omitempty"`
	ImageURL         *string          `json:"image_url,omitempty"`
	AvailableStock   int              `json:"available_stock"`
	IsAvailable      bool             `json:"is_available"`
	Quantity         *decimal.Decimal `json:"quantity,omitempty"`
	Unit             *string          `json:"unit,omitempty"`
	SortOrder        int              `json:"sort_order"`
	IsPrimary        bool             `json:"is_primary"`
	Role             *string          `json:"role,omitempty"`
}

// ShoppableProductResponse is the transport projection. Decimal quantities are
// strings so JSON consumers never lose precision through floating-point parsing.
type ShoppableProductResponse struct {
	RecipeProductID  int64    `json:"recipe_product_id"`
	ProductVariantID int64    `json:"product_variant_id"`
	ProductID        int64    `json:"product_id"`
	ProductTitle     string   `json:"product_title"`
	ProductSlug      *string  `json:"product_slug"`
	Brand            *string  `json:"brand,omitempty"`
	SKU              *string  `json:"sku,omitempty"`
	Price            float64  `json:"price"`
	CompareAtPrice   *float64 `json:"compare_at_price,omitempty"`
	ImageURL         *string  `json:"image_url,omitempty"`
	AvailableStock   int      `json:"available_stock"`
	IsAvailable      bool     `json:"is_available"`
	Quantity         *string  `json:"quantity,omitempty"`
	Unit             *string  `json:"unit,omitempty"`
	SortOrder        int      `json:"sort_order"`
	IsPrimary        bool     `json:"is_primary"`
	Role             *string  `json:"role,omitempty"`
}

type RecipeTagInfo struct {
	ID    int64  `json:"id"`
	Title string `json:"title"`
}

type RecipeDetailResponse struct {
	RecipeResponse
	Ingredients []RecipeIngredientResponse `json:"ingredients"`
	Products    []ShoppableProductResponse `json:"products"`
	Tags        []RecipeTagInfo            `json:"tags"`
	// StructuredData is a ready-to-embed schema.org/Recipe JSON-LD object for SEO.
	StructuredData map[string]any `json:"structured_data,omitempty"`
}

// SlugRedirectResponse is the 404-path answer for a retired slug: the slug the
// content lives at now.
type SlugRedirectResponse struct {
	Slug string `json:"slug"`
}

// RecipeSitemapItem feeds sitemap.xml generation on the frontend.
type RecipeSitemapItem struct {
	Slug      string    `json:"slug"`
	UpdatedAt time.Time `json:"updated_at"`
	ImageURL  *string   `json:"image_url,omitempty"`
}
