package models

import (
	"time"

	"github.com/shopspring/decimal"
)

// Decimal fields in analytics response models intentionally remain
// decimal.Decimal: its JSON marshaler emits quoted decimal strings, preserving
// precision across the Go/TypeScript boundary.

// ── JSONB embedded types ──────────────────────────────────────────────────────

type TopCategoryEntry struct {
	CategoryID string          `json:"category_id"`
	Revenue    decimal.Decimal `json:"revenue"`
	Units      int             `json:"units"`
}

type TopProductRevenueEntry struct {
	ProductID string          `json:"product_id"`
	Revenue   decimal.Decimal `json:"revenue"`
	Units     int             `json:"units"`
}

// ── Entity ────────────────────────────────────────────────────────────────────

type DailyRevenueStats struct {
	Date time.Time `json:"date"`

	// orders
	OrdersTotal     int `json:"orders_total"`
	OrdersCompleted int `json:"orders_completed"`
	OrdersCancelled int `json:"orders_cancelled"`
	OrdersRefunded  int `json:"orders_refunded"`

	// revenue
	GrossRevenue    decimal.Decimal `json:"gross_revenue"`
	RefundsTotal    decimal.Decimal `json:"refunds_total"`
	DiscountsTotal  decimal.Decimal `json:"discounts_total"`
	NetRevenue      decimal.Decimal `json:"net_revenue"`
	ShippingRevenue decimal.Decimal `json:"shipping_revenue"`
	AvgOrderValue   decimal.Decimal `json:"avg_order_value"`

	// payment breakdown
	RevenueCrypto decimal.Decimal `json:"revenue_crypto"`
	RevenueWallet decimal.Decimal `json:"revenue_wallet"`
	RevenueOther  decimal.Decimal `json:"revenue_other"`

	// customer breakdown
	OrdersNewCustomers int `json:"orders_new_customers"`
	OrdersReturning    int `json:"orders_returning"`
	UniqueCustomers    int `json:"unique_customers"`

	// coupons
	CouponUses          int             `json:"coupon_uses"`
	CouponDiscountTotal decimal.Decimal `json:"coupon_discount_total"`

	// cart
	CartsCreated        int             `json:"carts_created"`
	CartsAbandoned      int             `json:"carts_abandoned"`
	CartAbandonmentRate decimal.Decimal `json:"cart_abandonment_rate"`
	CartRecoveryCount   int             `json:"cart_recovery_count"`

	// traffic
	SessionsTotal     int             `json:"sessions_total"`
	SessionsNew       int             `json:"sessions_new"`
	SessionsReturning int             `json:"sessions_returning"`
	ConversionRate    decimal.Decimal `json:"conversion_rate"`

	// jsonb
	TopCategories []TopCategoryEntry       `json:"top_categories"`
	TopProducts   []TopProductRevenueEntry `json:"top_products"`

	ComputedAt time.Time `json:"computed_at"`
}

// ── Upsert request ────────────────────────────────────────────────────────────

type DailyRevenueStatsUpsertReq struct {
	Date time.Time `json:"date"`

	OrdersTotal     int `json:"orders_total"`
	OrdersCompleted int `json:"orders_completed"`
	OrdersCancelled int `json:"orders_cancelled"`
	OrdersRefunded  int `json:"orders_refunded"`

	GrossRevenue    decimal.Decimal `json:"gross_revenue"`
	RefundsTotal    decimal.Decimal `json:"refunds_total"`
	DiscountsTotal  decimal.Decimal `json:"discounts_total"`
	ShippingRevenue decimal.Decimal `json:"shipping_revenue"`

	RevenueCrypto decimal.Decimal `json:"revenue_crypto"`
	RevenueWallet decimal.Decimal `json:"revenue_wallet"`
	RevenueOther  decimal.Decimal `json:"revenue_other"`

	OrdersNewCustomers int `json:"orders_new_customers"`
	OrdersReturning    int `json:"orders_returning"`
	UniqueCustomers    int `json:"unique_customers"`

	CouponUses          int             `json:"coupon_uses"`
	CouponDiscountTotal decimal.Decimal `json:"coupon_discount_total"`

	CartsCreated      int `json:"carts_created"`
	CartsAbandoned    int `json:"carts_abandoned"`
	CartRecoveryCount int `json:"cart_recovery_count"`

	SessionsTotal     int `json:"sessions_total"`
	SessionsNew       int `json:"sessions_new"`
	SessionsReturning int `json:"sessions_returning"`

	TopCategories []TopCategoryEntry       `json:"top_categories"`
	TopProducts   []TopProductRevenueEntry `json:"top_products"`
}

// ── Filters ───────────────────────────────────────────────────────────────────

type RevenueStatsFilter struct {
	DateFrom time.Time
	DateTo   time.Time
}

// ── Responses ─────────────────────────────────────────────────────────────────

type RevenueStatsSummary struct {
	TotalOrders       int             `json:"total_orders"`
	TotalGrossRevenue decimal.Decimal `json:"total_gross_revenue"`
	TotalNetRevenue   decimal.Decimal `json:"total_net_revenue"`
	TotalRefunds      decimal.Decimal `json:"total_refunds"`
	TotalDiscounts    decimal.Decimal `json:"total_discounts"`
	AvgOrderValue     decimal.Decimal `json:"avg_order_value"`
	AvgConversionRate decimal.Decimal `json:"avg_conversion_rate"`
	UniqueCustomers   int             `json:"unique_customers"`
}
