// types/revenue.ts
import { BaseFilter } from "@/lib/types/filters";

// ------------------------------------------------
// Nested JSONB types
// ------------------------------------------------

export interface TopCategoryEntry {
  category_id: string;
  revenue: number; // decimal → number
  units: number;
}

export interface TopProductRevenueEntry {
  product_id: string;
  revenue: number;
  units: number;
}

// ------------------------------------------------
// Daily Revenue Stats
// ------------------------------------------------

export interface DailyRevenueStats {
  date: string; // YYYY-MM-DD (date only)

  // Orders
  orders_total: number;
  orders_completed: number;
  orders_cancelled: number;
  orders_refunded: number;

  // Revenue
  gross_revenue: number;
  refunds_total: number;
  discounts_total: number;
  net_revenue: number;
  shipping_revenue: number;
  avg_order_value: number;

  // Payment breakdown
  revenue_crypto: number;
  revenue_wallet: number;
  revenue_other: number;

  // Customer breakdown
  orders_new_customers: number;
  orders_returning: number;
  unique_customers: number;

  // Coupons
  coupon_uses: number;
  coupon_discount_total: number;

  // Cart
  carts_created: number;
  carts_abandoned: number;
  cart_abandonment_rate: number;
  cart_recovery_count: number;

  // Traffic
  sessions_total: number;
  sessions_new: number;
  sessions_returning: number;
  conversion_rate: number;

  // JSONB nested arrays
  top_categories: TopCategoryEntry[];
  top_products: TopProductRevenueEntry[];

  computed_at: string; // ISO datetime
}

// ------------------------------------------------
// Summary (for dashboard header)
// ------------------------------------------------

export interface RevenueStatsSummary {
  total_orders: number;
  total_gross_revenue: number;
  total_net_revenue: number;
  total_refunds: number;
  total_discounts: number;
  avg_order_value: number;
  avg_conversion_rate: number;
  unique_customers: number;
}

// ------------------------------------------------
// Request payloads / filters
// ------------------------------------------------

export interface RevenueStatsFilter {
  date_from: string; // YYYY-MM-DD
  date_to: string; // YYYY-MM-DD
}

export interface DailyRevenueStatsUpsertReq {
  date: string;
  orders_total: number;
  orders_completed: number;
  orders_cancelled: number;
  orders_refunded: number;
  gross_revenue: number;
  refunds_total: number;
  discounts_total: number;
  shipping_revenue: number;
  revenue_crypto: number;
  revenue_wallet: number;
  revenue_other: number;
  orders_new_customers: number;
  orders_returning: number;
  unique_customers: number;
  coupon_uses: number;
  coupon_discount_total: number;
  carts_created: number;
  carts_abandoned: number;
  cart_recovery_count: number;
  sessions_total: number;
  sessions_new: number;
  sessions_returning: number;
  top_categories: TopCategoryEntry[];
  top_products: TopProductRevenueEntry[];
}
