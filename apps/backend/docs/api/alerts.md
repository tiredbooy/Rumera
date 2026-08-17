# Product alerts

**Implementation (feature slice):** `internal/features/alerts/`  
(handler · service · repository · model · `routes.go` → `RegisterCustomer`).  
Composed from `internal/routes/routes.go`. Cron checker: `internal/corn/alert_check_job.go`
(PR-055a: `Dispatcher.DispatchAlert` when wired; `notified_at` only after
dispatch/send — PR-053a).

See [Authentication](../authentication.md) for the token model and [Conventions](../conventions.md) for the response/error envelope.

| Method | Path | Tier | Description |
|--------|------|------|-------------|
| GET | `/alerts` | 🔒 customer | List the caller's restock / price-drop subscriptions |
| POST | `/alerts` | 🔒 customer | Subscribe to a variant (restock or price-drop) |
| DELETE | `/alerts/:id` | 🔒 customer | Delete one of the caller's alerts |

> **Ownership:** every endpoint is scoped to the authenticated `userID`. There is no way to read or delete another user's alerts.

---

## Resource shape

```json
{
  "id": 11,
  "product_variant_id": 42,
  "alert_type": "price_drop",
  "target_price": 400000,
  "notified_at": null,
  "created_at": "2026-08-16T10:00:00Z",
  "product_title": "بطری شیراز",
  "product_slug": "shiraz-bottle",
  "current_price": 450000
}
```

| Field | Type | Notes |
|-------|------|--------|
| `id` | int64 | Alert id |
| `product_variant_id` | int64 | Subscribed variant |
| `alert_type` | string | `restock` \| `price_drop` |
| `target_price` | number \| null | Optional floor for `price_drop`; always present (JSON `null` when unset) |
| `notified_at` | RFC3339 \| null | Set by the checker **only after** dispatch/send (PR-053a / PR-055a) |
| `created_at` | RFC3339 | |
| `product_title` | string \| null | Parent product title. Hydrated on **GET**; `null` on POST create |
| `product_slug` | string \| null | Parent product slug (PDP path `/products/{slug}`). Hydrated on **GET** |
| `current_price` | number \| null | Live **variant** price (not product min). Hydrated on **GET** |

`product_title`, `product_slug`, and `current_price` are list enrichment (PR-053b) so the account page does not need a second product hop. Alerts are per-variant, so `current_price` is that variant's `product_variants.price`. Slug is nullable in the catalogue.

---

## List alerts

```
GET /alerts
Authorization: Bearer <access_token>
```

Returns the caller's alerts, newest first, joined to `products` + `product_variants` for title / slug / live price. Capped at 100 rows.

**Response** `200 OK` — `{ "data": [ ProductAlert, ... ] }`

`data` is always an array (empty when the caller has none).

**Errors:** `401 UNAUTHORIZED`.

---

## Create an alert

```
POST /alerts
Authorization: Bearer <access_token>
```

**Request body**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `product_variant_id` | int | ✓ | min `1`; must exist |
| `alert_type` | string | ✓ | `restock` \| `price_drop` |
| `target_price` | number | | `min=0` when present |

**Behaviour:**

- Snapshots the variant's current price as `reference_price` (not returned on the wire).
- Upserts on `(user_id, product_variant_id, alert_type)` — a second create resets `notified_at` and the reference/target prices.
- **Restock** is rejected with `CONFLICT` when available stock (`on_hand − committed`) is already `> 0`.
- **Restock** is also rejected with `CONFLICT` when the inventory row is **missing** (PR-053c). A missing row is not treated as out of stock; create fails closed so the checker cannot fire on an untracked variant. Unexpected inventory lookup errors are `INTERNAL_ERROR` (still no row written).

**Response** `201 Created` — `{ "data": ProductAlert }`. Create does **not** join the catalogue; `product_title`, `product_slug`, and `current_price` are JSON `null`.

**Errors:** `401`, `VALIDATION_ERROR`, `NOT_FOUND` (unknown variant), `CONFLICT` (restock while in stock **or inventory row missing**), `INTERNAL_ERROR` (inventory lookup failed).

---

## Delete an alert

```
DELETE /alerts/:id
Authorization: Bearer <access_token>
```

Deletes only if the row belongs to the caller.

**Response** `204 No Content`.

**Errors:** `401`, `NOT_FOUND` (missing id or not owned).
