# Coupons

**Implementation (feature slice):** `internal/features/coupons/`  
Composed from `internal/routes/routes.go`. Order redemption uses `Repository`/`UsageRepository` under tx. API contracts unchanged.


Customers preview a coupon against their basket at checkout; admins manage the coupon catalogue.

See [Authentication](../authentication.md) for the token model and trust tiers, and [Conventions](../conventions.md) for the response/error envelope, pagination, and sorting.

| Method | Path | Tier | Description |
|--------|------|------|-------------|
| POST | `/coupons/validate` | 🔒 customer | Preview a coupon for the caller's basket |
| POST | `/admin/coupons` | 🛡️ admin | Create a coupon |
| GET | `/admin/coupons` | 🛡️ admin | List coupons |
| GET | `/admin/coupons/:id` | 🛡️ admin | Get one coupon |
| PATCH | `/admin/coupons/:id` | 🛡️ admin | Update a coupon |
| DELETE | `/admin/coupons/:id` | 🛡️ admin | Delete a coupon |

> **Discount types:** `percentage` (`discount_value` is a percent, optionally capped by `max_discount_amount`), `fixed_amount` (flat currency off), or `free_shipping`.

---

## Validate a coupon

```
POST /coupons/validate
Authorization: Bearer <access_token>
```

Previews whether a coupon applies to the supplied basket and what discount it yields. The user is taken from the token — any `user_id` in the body is ignored — so per-user usage limits are enforced for the caller. Validate never records usage; redemption happens under lock at order creation.

When `product_ids` and `category_ids` are both omitted (empty) and/or `order_subtotal` is `0` or omitted, the server loads the authenticated user's cart (`GetOrCreate` + `GetItems`) and derives those fields from cart line `product_id`, `category_id`, and `line_total`. Checkout may send `{code, order_subtotal}` only; scoped coupons then preview the same basket `CreateOrder` will redeem against.

An empty cart is validated as an empty basket (`is_valid: false` for `min_order_amount` / applicability). Cart lookup failures are `500`; an empty cart is not.

**Request body**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `code` | string | ✓ | |
| `order_subtotal` | number | | min `0`. When `0`/omitted, filled from the caller's cart line totals |
| `product_ids` | int[] | | product ids in the basket. When both this and `category_ids` are empty, filled from the caller's cart |
| `category_ids` | int[] | | categories represented in the basket. Same cart fallback as `product_ids` |

```json
{
  "code": "SUMMER10",
  "order_subtotal": 99.80,
  "product_ids": [7, 12],
  "category_ids": [3]
}
```

Minimal checkout body (IDs and/or subtotal loaded from the caller's cart):

```json
{ "code": "SUMMER10" }
```

**Response** `200 OK` — `CouponValidationResult`:

```json
{
  "data": {
    "coupon": {
      "id": 5,
      "code": "SUMMER10",
      "discount_type": "percentage",
      "discount_value": 10
    },
    "discount_amount": 9.98,
    "free_shipping": false,
    "is_valid": true,
    "invalid_reason": ""
  }
}
```

When the coupon does not apply, `is_valid` is `false`, `discount_amount` is `0`, and `invalid_reason` explains why (e.g. expired, below `min_order_amount`, usage limit reached, not applicable to these products/categories, or empty cart). An unknown code is the same `200` + `is_valid: false` shape, not a 404.

**Errors:** `401 UNAUTHORIZED`, `422 VALIDATION_ERROR`, `500 INTERNAL_ERROR` (cart lookup failed).

---

## Create a coupon

```
POST /admin/coupons
Authorization: Bearer <access_token>
```

**Request body**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `code` | string | ✓ | max 64 chars |
| `description` | string | | |
| `discount_type` | string | ✓ | one of `percentage` `fixed_amount` `free_shipping` |
| `discount_value` | number | | min `0` |
| `max_discount_amount` | number | | `> 0` (caps a percentage discount) |
| `min_order_amount` | number | | min `0` |
| `max_uses` | int | | min `1` (total redemptions; omit for unlimited) |
| `max_uses_per_user` | int | ✓ | min `1` |
| `applicable_to` | object | | `{ "category_ids": [...], "product_ids": [...] }`; omit to apply to all |
| `is_active` | bool | | defaults to active |
| `starts_at` | string (date-time) | | |
| `expires_at` | string (date-time) | | |

```json
{
  "code": "SUMMER10",
  "discount_type": "percentage",
  "discount_value": 10,
  "max_discount_amount": 25,
  "min_order_amount": 50,
  "max_uses": 1000,
  "max_uses_per_user": 1,
  "applicable_to": { "category_ids": [3] },
  "starts_at": "2026-06-01T00:00:00Z",
  "expires_at": "2026-09-01T00:00:00Z"
}
```

**Response** `201 Created` — `CouponResponse`:

```json
{
  "data": {
    "id": 5,
    "code": "SUMMER10",
    "discount_type": "percentage",
    "discount_value": 10,
    "max_discount_amount": 25,
    "min_order_amount": 50,
    "max_uses": 1000,
    "max_uses_per_user": 1,
    "applicable_to": { "category_ids": [3] },
    "is_active": true,
    "starts_at": "2026-06-01T00:00:00Z",
    "expires_at": "2026-09-01T00:00:00Z",
    "total_uses": 0
  }
}
```

**Errors:** `401 UNAUTHORIZED`, `403 INSUFFICIENT_PERMISSIONS`, `422 VALIDATION_ERROR`, `409 CONFLICT` (duplicate `code`).

---

## List coupons

```
GET /admin/coupons
Authorization: Bearer <access_token>
```

Standard pagination, sorting, and search (see [Conventions](../conventions.md)). Sorts by `created_at` by default.

**Filters**

| Param | Type | Description |
|-------|------|-------------|
| `is_active` | bool | Filter by active flag |
| `discount_type` | string | `percentage` `fixed_amount` `free_shipping` |
| `active_only` | bool | Only coupons currently within their active window |

**Response** `200 OK` — paginated `CouponResponse` list (`results` + `pagination`).

**Errors:** `401 UNAUTHORIZED`, `403 INSUFFICIENT_PERMISSIONS`, `400 INVALID_QUERY`.

---

## Get one coupon

```
GET /admin/coupons/:id
Authorization: Bearer <access_token>
```

**Response** `200 OK` — `CouponResponse`, with `total_uses` populated from the redemption count.

**Errors:** `401 UNAUTHORIZED`, `403 INSUFFICIENT_PERMISSIONS`, `400 INVALID_PARAMS`, `404 NOT_FOUND`.

---

## Update a coupon

```
PATCH /admin/coupons/:id
Authorization: Bearer <access_token>
```

All fields optional; only supplied fields are updated. The `code` and `discount_type` are immutable after creation and are not accepted here.

| Field | Type | Validation |
|-------|------|------------|
| `description` | string | |
| `discount_value` | number | min `0` |
| `max_discount_amount` | number | `> 0` |
| `min_order_amount` | number | min `0` |
| `max_uses` | int | min `1` |
| `max_uses_per_user` | int | min `1` |
| `applicable_to` | object | `{ "category_ids": [...], "product_ids": [...] }` |
| `is_active` | bool | |
| `starts_at` | string (date-time) | |
| `expires_at` | string (date-time) | |

**Response** `200 OK` — updated `CouponResponse`.

**Errors:** `401 UNAUTHORIZED`, `403 INSUFFICIENT_PERMISSIONS`, `400 INVALID_PARAMS`, `422 VALIDATION_ERROR`, `404 NOT_FOUND`.

---

## Delete a coupon

```
DELETE /admin/coupons/:id
Authorization: Bearer <access_token>
```

**Response** `204 No Content`.

**Errors:** `401 UNAUTHORIZED`, `403 INSUFFICIENT_PERMISSIONS`, `400 INVALID_PARAMS`, `404 NOT_FOUND`.
