package models

import (
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
)

// ── Entity ────────────────────────────────────────────────────────────────────

type DailyProductStats struct {
	Date      time.Time `json:"date"`
	ProductID uuid.UUID `json:"product_id"`

	// views
	ViewsTotal      int `json:"views_total"`
	ViewsUnique     int `json:"views_unique"`
	ViewsRegistered int `json:"views_registered"`
	ViewsGuest      int `json:"views_guest"`

	// engagement
	AvgViewDurationSec decimal.Decimal `json:"avg_view_duration_sec"`
	ImageViewsTotal    int             `json:"image_views_total"`
	VariantSelections  int             `json:"variant_selections"`

	// funnel
	AddToCartCount       int `json:"add_to_cart_count"`
	AddToWishlistCount   int `json:"add_to_wishlist_count"`
	CheckoutStartedCount int `json:"checkout_started_count"`
	PurchaseCount        int `json:"purchase_count"`
	UnitsSold            int `json:"units_sold"`

	// revenue
	RevenueTotal decimal.Decimal `json:"revenue_total"`

	// conversion rates
	ViewToCartRate     decimal.Decimal `json:"view_to_cart_rate"`
	CartToPurchaseRate decimal.Decimal `json:"cart_to_purchase_rate"`

	// source breakdown
	SourceSearch         int `json:"source_search"`
	SourceCategory       int `json:"source_category"`
	SourceRecommendation int `json:"source_recommendation"`
	SourceDirect         int `json:"source_direct"`
	SourceBlog           int `json:"source_blog"`
	SourceRecipe         int `json:"source_recipe"`

	// device breakdown
	DeviceMobile  int `json:"device_mobile"`
	DeviceDesktop int `json:"device_desktop"`
	DeviceTablet  int `json:"device_tablet"`

	// quality
	ReturnCount int              `json:"return_count"`
	ReviewCount int              `json:"review_count"`
	AvgRating   *decimal.Decimal `json:"avg_rating"`

	ComputedAt time.Time `json:"computed_at"`
}

// ── Upsert request (used by cron) ─────────────────────────────────────────────

type DailyProductStatsUpsertReq struct {
	Date      time.Time `json:"date"`
	ProductID uuid.UUID `json:"product_id"`

	ViewsTotal      int `json:"views_total"`
	ViewsUnique     int `json:"views_unique"`
	ViewsRegistered int `json:"views_registered"`
	ViewsGuest      int `json:"views_guest"`

	AvgViewDurationSec decimal.Decimal `json:"avg_view_duration_sec"`
	ImageViewsTotal    int             `json:"image_views_total"`
	VariantSelections  int             `json:"variant_selections"`

	AddToCartCount       int `json:"add_to_cart_count"`
	AddToWishlistCount   int `json:"add_to_wishlist_count"`
	CheckoutStartedCount int `json:"checkout_started_count"`
	PurchaseCount        int `json:"purchase_count"`
	UnitsSold            int `json:"units_sold"`

	RevenueTotal decimal.Decimal `json:"revenue_total"`

	SourceSearch         int `json:"source_search"`
	SourceCategory       int `json:"source_category"`
	SourceRecommendation int `json:"source_recommendation"`
	SourceDirect         int `json:"source_direct"`
	SourceBlog           int `json:"source_blog"`
	SourceRecipe         int `json:"source_recipe"`

	DeviceMobile  int `json:"device_mobile"`
	DeviceDesktop int `json:"device_desktop"`
	DeviceTablet  int `json:"device_tablet"`

	ReturnCount int              `json:"return_count"`
	ReviewCount int              `json:"review_count"`
	AvgRating   *decimal.Decimal `json:"avg_rating"`
}

// ── Query filters ─────────────────────────────────────────────────────────────

type ProductStatsFilter struct {
	ProductID *uuid.UUID
	DateFrom  time.Time
	DateTo    time.Time
}

// ── Responses ─────────────────────────────────────────────────────────────────

type ProductStatsSummary struct {
	ProductID          uuid.UUID        `json:"product_id"`
	TotalViews         int              `json:"total_views"`
	TotalRevenue       decimal.Decimal  `json:"total_revenue"`
	TotalUnitsSold     int              `json:"total_units_sold"`
	TotalPurchases     int              `json:"total_purchases"`
	AvgViewToCartRate  decimal.Decimal  `json:"avg_view_to_cart_rate"`
	AvgCartToPurchRate decimal.Decimal  `json:"avg_cart_to_purchase_rate"`
	AvgRating          *decimal.Decimal `json:"avg_rating"`
}

type TopProductEntry struct {
	ProductID    uuid.UUID       `json:"product_id"`
	TotalRevenue decimal.Decimal `json:"total_revenue"`
	TotalViews   int             `json:"total_views"`
	UnitsSold    int             `json:"units_sold"`
}
