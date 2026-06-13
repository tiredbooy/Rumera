package models

import (
	"time"

	"github.com/shopspring/decimal"
)

type RecipeDifficulty string

const (
	RecipeDifficultyEasy   RecipeDifficulty = "easy"
	RecipeDifficultyMedium RecipeDifficulty = "medium"
	RecipeDifficultyHard   RecipeDifficulty = "hard"
)

// ── Entities ──────────────────────────────────────────────────────────────────

type Recipe struct {
	ID              int64            `json:"id"`
	Title           string           `json:"title"`
	Slug            string           `json:"slug"`
	Description     *string          `json:"description"`
	Content         string           `json:"content"`
	Difficulty      RecipeDifficulty `json:"difficulty"`
	PrepTimeMinutes int              `json:"prep_time_minutes"`
	CookTimeMinutes int              `json:"cook_time_minutes"`
	Servings        int              `json:"servings"`
	ImageURL        *string          `json:"image_url"`
	UserID          *int64           `json:"user_id"`
	CreatedAt       time.Time        `json:"created_at"`
	UpdatedAt       time.Time        `json:"updated_at"`
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
}

type RecipeTag struct {
	ID       int64 `json:"id"`
	RecipeID int64 `json:"recipe_id"`
	TagID    int64 `json:"tag_id"`
}

// ── Requests ──────────────────────────────────────────────────────────────────

type RecipeReq struct {
	Title           string           `json:"title"`
	Slug            string           `json:"slug"`
	Description     *string          `json:"description"`
	Content         string           `json:"content"`
	Difficulty      RecipeDifficulty `json:"difficulty"`
	PrepTimeMinutes int              `json:"prep_time_minutes"`
	CookTimeMinutes int              `json:"cook_time_minutes"`
	Servings        int              `json:"servings"`
	ImageURL        *string          `json:"image_url"`
	UserID          *int64           `json:"user_id"`
}

type RecipeUpdateReq struct {
	Title           *string           `json:"title"`
	Slug            *string           `json:"slug"`
	Description     *string           `json:"description"`
	Content         *string           `json:"content"`
	Difficulty      *RecipeDifficulty `json:"difficulty"`
	PrepTimeMinutes *int              `json:"prep_time_minutes"`
	CookTimeMinutes *int              `json:"cook_time_minutes"`
	Servings        *int              `json:"servings"`
	ImageURL        *string           `json:"image_url"`
}

type RecipeIngredientReq struct {
	ProductVariantID *int64           `json:"product_variant_id"`
	IngredientName   string           `json:"ingredient_name"`
	Quantity         *decimal.Decimal `json:"quantity"`
	Unit             *string          `json:"unit"`
	Optional         bool             `json:"optional"`
	Notes            *string          `json:"notes"`
	SortOrder        *int             `json:"sort_order"`
}

type RecipeProductReq struct {
	ProductVariantID int64            `json:"product_variant_id"`
	Quantity         *decimal.Decimal `json:"quantity"`
	Unit             *string          `json:"unit"`
}

// ── Responses ─────────────────────────────────────────────────────────────────

type RecipeResponse struct {
	ID              int64            `json:"id"`
	Title           string           `json:"title"`
	Slug            string           `json:"slug"`
	Description     *string          `json:"description"`
	Content         string           `json:"content"`
	Difficulty      RecipeDifficulty `json:"difficulty"`
	PrepTimeMinutes int              `json:"prep_time_minutes"`
	CookTimeMinutes int              `json:"cook_time_minutes"`
	Servings        int              `json:"servings"`
	ImageURL        *string          `json:"image_url"`
	UserID          *int64           `json:"user_id"`
	CreatedAt       time.Time        `json:"created_at"`
	UpdatedAt       time.Time        `json:"updated_at"`
}

type RecipeIngredientResponse struct {
	ID               int64            `json:"id"`
	ProductVariantID *int64           `json:"product_variant_id"`
	IngredientName   string           `json:"ingredient_name"`
	Quantity         *decimal.Decimal `json:"quantity"`
	Unit             *string          `json:"unit"`
	Optional         bool             `json:"optional"`
	Notes            *string          `json:"notes"`
	SortOrder        int              `json:"sort_order"`
}

type RecipeProductResponse struct {
	ID               int64            `json:"id"`
	ProductVariantID int64            `json:"product_variant_id"`
	Quantity         *decimal.Decimal `json:"quantity"`
	Unit             *string          `json:"unit"`
}

type RecipeDetailResponse struct {
	RecipeResponse
	Ingredients []RecipeIngredientResponse `json:"ingredients"`
	Products    []RecipeProductResponse    `json:"products"`
	TagIDs      []int64                    `json:"tag_ids"`
}
