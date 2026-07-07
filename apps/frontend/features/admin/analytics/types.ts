// ── JSONB sub-structures ──────────────────────────────
export interface TopCategoryEntry {
  category_id: string;
  revenue: string; // decimal
  units: number;
}

export interface TopProductRevenueEntry {
  product_id: string;
  revenue: string;
  units: number;
}

// ── Daily revenue stats (full record) ─────────────────
export interface DailyRevenueStats {
  date: string; // ISO date
  orders_total: number;
  orders_completed: number;
  orders_cancelled: number;
  orders_refunded: number;
  gross_revenue: string;
  refunds_total: string;
  discounts_total: string;
  net_revenue: string;
  shipping_revenue: string;
  avg_order_value: string;
  revenue_crypto: string;
  revenue_wallet: string;
  revenue_other: string;
  orders_new_customers: number;
  orders_returning: number;
  unique_customers: number;
  coupon_uses: number;
  coupon_discount_total: string;
  carts_created: number;
  carts_abandoned: number;
  cart_abandonment_rate: string;
  cart_recovery_count: number;
  sessions_total: number;
  sessions_new: number;
  sessions_returning: number;
  conversion_rate: string;
  top_categories: TopCategoryEntry[];
  top_products: TopProductRevenueEntry[];
  computed_at: string;
}

// ── Summary response (aggregated) ─────────────────────
export interface RevenueStatsSummary {
  total_orders: number;
  total_gross_revenue: string;
  total_net_revenue: string;
  total_refunds: string;
  total_discounts: string;
  avg_order_value: string;
  avg_conversion_rate: string;
  unique_customers: number;
}

// ── Time‑series point (assumed shape) ─────────────────
export interface RevenueTimeSeriesPoint {
  date: string; // "2026-07-07"
  net_revenue: string;
  orders_count?: number; // optional, backend may include
}

// ── Search term stats ─────────────────────────────────
export interface SearchTermStat {
  term: string;
  count: number;
}

// ── Event breakdown (generic) ─────────────────────────
export interface EventBreakdownItem {
  event: string;
  count: number;
  percentage?: number;
}

// ── Filters ───────────────────────────────────────────
export interface RevenueStatsFilter {
  date_from?: string; // YYYY-MM-DD
  date_to?: string;
}
