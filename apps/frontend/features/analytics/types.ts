export type DecimalString = string;

/**
 * Analytics stores product IDs as UUIDs while the catalog uses BIGINT IDs.
 * Keep this value opaque until the backend provides a canonical mapping.
 */
export type AnalyticsProductId = string;

export interface TopCategoryEntry {
  category_id: string;
  revenue: DecimalString;
  units: number;
}

export interface TopProductRevenueEntry {
  product_id: AnalyticsProductId;
  revenue: DecimalString;
  units: number;
}

export interface DailyRevenueStats {
  date: string;
  orders_total: number;
  orders_completed: number;
  orders_cancelled: number;
  orders_refunded: number;
  gross_revenue: DecimalString;
  refunds_total: DecimalString;
  discounts_total: DecimalString;
  net_revenue: DecimalString;
  shipping_revenue: DecimalString;
  avg_order_value: DecimalString;
  revenue_crypto: DecimalString;
  revenue_wallet: DecimalString;
  revenue_other: DecimalString;
  orders_new_customers: number;
  orders_returning: number;
  unique_customers: number;
  coupon_uses: number;
  coupon_discount_total: DecimalString;
  carts_created: number;
  carts_abandoned: number;
  cart_abandonment_rate: DecimalString;
  cart_recovery_count: number;
  sessions_total: number;
  sessions_new: number;
  sessions_returning: number;
  conversion_rate: DecimalString;
  top_categories: TopCategoryEntry[];
  top_products: TopProductRevenueEntry[];
  computed_at: string;
}

export interface RevenueStatsSummary {
  total_orders: number;
  total_gross_revenue: DecimalString;
  total_net_revenue: DecimalString;
  total_refunds: DecimalString;
  total_discounts: DecimalString;
  avg_order_value: DecimalString;
  avg_conversion_rate: DecimalString;
  unique_customers: number;
}

export interface DailyProductStats {
  date: string;
  product_id: AnalyticsProductId;
  views_total: number;
  views_unique: number;
  views_registered: number;
  views_guest: number;
  avg_view_duration_sec: DecimalString;
  image_views_total: number;
  variant_selections: number;
  add_to_cart_count: number;
  add_to_wishlist_count: number;
  checkout_started_count: number;
  purchase_count: number;
  units_sold: number;
  revenue_total: DecimalString;
  view_to_cart_rate: DecimalString;
  cart_to_purchase_rate: DecimalString;
  source_search: number;
  source_category: number;
  source_recommendation: number;
  source_direct: number;
  source_blog: number;
  source_recipe: number;
  device_mobile: number;
  device_desktop: number;
  device_tablet: number;
  return_count: number;
  review_count: number;
  avg_rating: DecimalString | null;
  computed_at: string;
}

export interface ProductStatsSummary {
  product_id: AnalyticsProductId;
  total_views: number;
  total_revenue: DecimalString;
  total_units_sold: number;
  total_purchases: number;
  avg_view_to_cart_rate: DecimalString;
  avg_cart_to_purchase_rate: DecimalString;
  avg_rating: DecimalString | null;
}

export interface TopProductEntry {
  product_id: AnalyticsProductId;
  total_revenue: DecimalString;
  total_views: number;
  units_sold: number;
}

export interface SearchTermSummary {
  query_text: string;
  total_searches: number;
  total_clicks: number;
  avg_ctr: DecimalString;
  total_purchases: number;
  avg_conversion: DecimalString;
  zero_results: number;
}

export type EventBreakdown = Record<string, number>;

export interface AnalyticsDateRange {
  from?: string;
  to?: string;
}

export interface AnalyticsTopQuery extends AnalyticsDateRange {
  limit?: number;
}
