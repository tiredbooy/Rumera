# Analytics

Read-only admin dashboard queries over pre-aggregated daily revenue, product, and search statistics, plus raw event counts.

See [Authentication](../authentication.md) for the token model and trust tiers, and [Conventions](../conventions.md) for the response/error envelope.

| Method | Path | Tier | Description |
|--------|------|------|-------------|
| GET | `/admin/analytics/revenue/summary` | 🛡️ admin | Aggregated revenue over a range |
| GET | `/admin/analytics/revenue/timeseries` | 🛡️ admin | Daily revenue rows over a range |
| GET | `/admin/analytics/revenue/today` | 🛡️ admin | Today's revenue row |
| GET | `/admin/analytics/products/top-revenue` | 🛡️ admin | Top products by revenue |
| GET | `/admin/analytics/products/top-views` | 🛡️ admin | Top products by views |
| GET | `/admin/analytics/products/:productID/summary` | 🛡️ admin | One product's aggregated stats |
| GET | `/admin/analytics/products/:productID/timeseries` | 🛡️ admin | One product's daily rows |
| GET | `/admin/analytics/search/top-terms` | 🛡️ admin | Most-searched terms |
| GET | `/admin/analytics/search/zero-result` | 🛡️ admin | Terms returning no results |
| GET | `/admin/analytics/search/top-converting` | 🛡️ admin | Highest-converting terms |
| GET | `/admin/analytics/events/breakdown` | 🛡️ admin | Event counts by type |

Legend: 🌐 public · 🔒 customer · 🛡️ admin.

## Common query parameters

Every endpoint (except `revenue/today`, which always reads the current day) accepts a date range:

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `from` | string (RFC3339) | now − 30 days | Inclusive start of range |
| `to` | string (RFC3339) | now | Inclusive end of range |

If `from` or `to` is present but not valid RFC3339, or `from` is after `to`, the request fails with `400 INVALID_QUERY`.

The "top" endpoints additionally accept a `limit`:

| Param | Type | Default | Max | Description |
|-------|------|---------|-----|-------------|
| `limit` | int | varies (see endpoint) | 100 | Number of rows to return |

A `limit` that is missing, non-numeric, `≤ 0`, or `> 100` falls back to the endpoint default.

All responses are wrapped in the `data` envelope described in [Conventions](../conventions.md).

> **Note on `:productID`** — it is a **UUID**. A malformed UUID fails with `400 INVALID_PARAMS`.

Every endpoint can return `401 UNAUTHORIZED` (missing/invalid token) and `403 INSUFFICIENT_PERMISSIONS` (non-admin caller). Those are not repeated per-endpoint below.

---

## Revenue summary

```
GET /admin/analytics/revenue/summary?from=<RFC3339>&to=<RFC3339>
Authorization: Bearer <access_token>
```

Aggregates revenue metrics across the range (period-over-period dashboard cards).

**Response** `200 OK` — a single `RevenueStatsSummary` inside `data`:

```json
{
  "data": {
    "total_orders": 1284,
    "total_gross_revenue": "98230.50",
    "total_net_revenue": "91110.00",
    "total_refunds": "4200.00",
    "total_discounts": "2920.50",
    "avg_order_value": "76.50",
    "avg_conversion_rate": "0.0312",
    "unique_customers": 903
  }
}
```

Fields: `total_orders` (int), `total_gross_revenue`, `total_net_revenue`, `total_refunds`, `total_discounts`, `avg_order_value`, `avg_conversion_rate` (all decimal strings), `unique_customers` (int).

**Errors:** `400 INVALID_QUERY`.

---

## Revenue timeseries

```
GET /admin/analytics/revenue/timeseries?from=<RFC3339>&to=<RFC3339>
Authorization: Bearer <access_token>
```

**Response** `200 OK` — a `data` array of `DailyRevenueStats` rows, one per day in range. Each row carries the full daily breakdown: order counts (`orders_total`, `orders_completed`, `orders_cancelled`, `orders_refunded`); revenue (`gross_revenue`, `refunds_total`, `discounts_total`, `net_revenue`, `shipping_revenue`, `avg_order_value`); payment split (`revenue_crypto`, `revenue_wallet`, `revenue_other`); customer split (`orders_new_customers`, `orders_returning`, `unique_customers`); coupons (`coupon_uses`, `coupon_discount_total`); cart metrics (`carts_created`, `carts_abandoned`, `cart_abandonment_rate`, `cart_recovery_count`); traffic (`sessions_total`, `sessions_new`, `sessions_returning`, `conversion_rate`); and JSONB arrays `top_categories` and `top_products`. Decimal fields serialize as strings.

```json
{
  "data": [
    {
      "date": "2026-06-10T00:00:00Z",
      "orders_total": 42,
      "gross_revenue": "3210.00",
      "net_revenue": "3010.00",
      "avg_order_value": "76.43",
      "conversion_rate": "0.031",
      "top_products": [
        { "product_id": "9c…-uuid", "revenue": "820.00", "units": 12 }
      ],
      "top_categories": [
        { "category_id": "3", "revenue": "1450.00", "units": 19 }
      ],
      "computed_at": "2026-06-11T02:00:00Z"
    }
  ]
}
```

**Errors:** `400 INVALID_QUERY`.

---

## Revenue today

```
GET /admin/analytics/revenue/today
Authorization: Bearer <access_token>
```

Convenience endpoint for the live dashboard — always pulls the current (UTC) day's row. Takes no query parameters.

**Response** `200 OK` — a single `DailyRevenueStats` row inside `data` (same shape as a timeseries element).

---

## Top products by revenue

```
GET /admin/analytics/products/top-revenue?from=<RFC3339>&to=<RFC3339>&limit=<n>
Authorization: Bearer <access_token>
```

`limit` defaults to **10** (max 100).

**Response** `200 OK` — a `data` array of `TopProductEntry`:

```json
{
  "data": [
    { "product_id": "9c…-uuid", "total_revenue": "12840.00", "total_views": 5210, "units_sold": 184 }
  ]
}
```

Fields: `product_id` (UUID), `total_revenue` (decimal string), `total_views` (int), `units_sold` (int).

**Errors:** `400 INVALID_QUERY`.

---

## Top products by views

```
GET /admin/analytics/products/top-views?from=<RFC3339>&to=<RFC3339>&limit=<n>
Authorization: Bearer <access_token>
```

`limit` defaults to **10** (max 100).

**Response** `200 OK` — a `data` array of `TopProductEntry` (same shape as top-revenue, ordered by views).

**Errors:** `400 INVALID_QUERY`.

---

## Product stats summary

```
GET /admin/analytics/products/:productID/summary?from=<RFC3339>&to=<RFC3339>
Authorization: Bearer <access_token>
```

`:productID` is a UUID. Aggregates one product's stats across the range.

**Response** `200 OK` — a single `ProductStatsSummary` inside `data`:

```json
{
  "data": {
    "product_id": "9c…-uuid",
    "total_views": 5210,
    "total_revenue": "12840.00",
    "total_units_sold": 184,
    "total_purchases": 171,
    "avg_view_to_cart_rate": "0.084",
    "avg_cart_to_purchase_rate": "0.612",
    "avg_rating": "4.6"
  }
}
```

Fields: `product_id` (UUID), `total_views`, `total_units_sold`, `total_purchases` (ints), `total_revenue`, `avg_view_to_cart_rate`, `avg_cart_to_purchase_rate` (decimal strings), `avg_rating` (decimal string or null).

**Errors:** `400 INVALID_PARAMS` (bad UUID), `400 INVALID_QUERY`.

---

## Product stats timeseries

```
GET /admin/analytics/products/:productID/timeseries?from=<RFC3339>&to=<RFC3339>
Authorization: Bearer <access_token>
```

`:productID` is a UUID.

**Response** `200 OK` — a `data` array of `DailyProductStats` rows, one per day. Each row carries the full daily breakdown for the product: views (`views_total`, `views_unique`, `views_registered`, `views_guest`); engagement (`avg_view_duration_sec`, `image_views_total`, `variant_selections`); funnel (`add_to_cart_count`, `add_to_wishlist_count`, `checkout_started_count`, `purchase_count`, `units_sold`); `revenue_total`; conversion (`view_to_cart_rate`, `cart_to_purchase_rate`); source split (`source_search`, `source_category`, `source_recommendation`, `source_direct`, `source_blog`, `source_recipe`); device split (`device_mobile`, `device_desktop`, `device_tablet`); and quality (`return_count`, `review_count`, `avg_rating`). Decimal fields serialize as strings; `avg_rating` may be null.

**Errors:** `400 INVALID_PARAMS` (bad UUID), `400 INVALID_QUERY`.

---

## Top search terms

```
GET /admin/analytics/search/top-terms?from=<RFC3339>&to=<RFC3339>&limit=<n>
Authorization: Bearer <access_token>
```

`limit` defaults to **20** (max 100).

**Response** `200 OK` — a `data` array of `SearchTermSummary`:

```json
{
  "data": [
    {
      "query_text": "single malt",
      "total_searches": 4210,
      "total_clicks": 2890,
      "avg_ctr": "0.686",
      "total_purchases": 410,
      "avg_conversion": "0.097",
      "zero_results": 12
    }
  ]
}
```

Fields: `query_text` (string), `total_searches`, `total_clicks`, `total_purchases`, `zero_results` (ints), `avg_ctr`, `avg_conversion` (decimal strings).

**Errors:** `400 INVALID_QUERY`.

---

## Zero-result search terms

```
GET /admin/analytics/search/zero-result?from=<RFC3339>&to=<RFC3339>&limit=<n>
Authorization: Bearer <access_token>
```

Terms that returned no results — useful for catalogue gaps. `limit` defaults to **20** (max 100).

**Response** `200 OK` — a `data` array of `SearchTermSummary` (same shape as top-terms).

**Errors:** `400 INVALID_QUERY`.

---

## Top-converting search terms

```
GET /admin/analytics/search/top-converting?from=<RFC3339>&to=<RFC3339>&limit=<n>
Authorization: Bearer <access_token>
```

Terms with the highest search-to-purchase conversion. `limit` defaults to **20** (max 100).

**Response** `200 OK` — a `data` array of `SearchTermSummary` (same shape as top-terms).

**Errors:** `400 INVALID_QUERY`.

---

## Event breakdown

```
GET /admin/analytics/events/breakdown?from=<RFC3339>&to=<RFC3339>
Authorization: Bearer <access_token>
```

Counts raw events by `event_type` over the range.

**Response** `200 OK` — a `data` map of `event_type` → count:

```json
{
  "data": {
    "product_view": 51820,
    "add_to_cart": 7210,
    "search": 18430,
    "purchase": 1284
  }
}
```

**Errors:** `400 INVALID_QUERY`.
