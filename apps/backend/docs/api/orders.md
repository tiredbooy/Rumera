# Orders


**Implementation (feature slice):** `internal/features/orders/`
Place, list, and inspect orders, cancel pending orders, and manage every order from the admin surface.

See [Authentication](../authentication.md) for the token model and trust tiers, and [Conventions](../conventions.md) for the response/error envelope, pagination, and sorting.

| Method | Path | Tier | Description |
|--------|------|------|-------------|
| POST | `/orders` | 🔒 customer | Place an order |
| GET | `/orders` | 🔒 customer | List own orders |
| GET | `/orders/:id` | 🔒 customer | Get one of own orders |
| POST | `/orders/:id/cancel` | 🔒 customer | Cancel a pending order |
| GET | `/admin/orders` | 🛡️ admin | List all orders |
| GET | `/admin/orders/:id` | 🛡️ admin | Get any order |
| PATCH | `/admin/orders/:id/status` | 🛡️ admin | Update an order's status |

> **Ownership:** customer endpoints are user-scoped — they only ever return the caller's own orders. The owning user is resolved from the authenticated token (`uid`) server-side, so passing another user's order id yields `404 ORDER_NOT_FOUND` rather than someone else's data.

---

## Place an order

```
POST /orders
Authorization: Bearer <access_token>
Idempotency-Key: <uuid-once-per-checkout-intent>   # strongly recommended
```

Creates an order for the authenticated user from their current cart context. Stock is reserved and any coupon is validated at this point.

**Idempotency (PH-011):** optional `Idempotency-Key` (8–128 printable ASCII). When
present, a successful 2xx response is cached under a **scoped** store key
(`cust:{uid}:POST:…`). Retries with the same key + same body return the stored
response without creating a second order. Same key + different body → `409`.
Missing key still works (no HTTP cache). See
[idempotency.md](../architecture/idempotency.md) and
[idempotency-runbook.md](../architecture/idempotency-runbook.md).

**Request body** — `CreateOrderReq`

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `address_id` | int | ✓ | min `1` |
| `payment_method` | string | ✓ | one of `card` `crypto` `bank_transfer` `wallet` `gateway` |
| `shipping_method_id` | int | ✓ | min `1` |
| `coupon_code` | string | | optional |
| `notes` | string | | optional |
| `is_gift` | bool | | when true, gift settings must be enabled |
| `gift_message` | string | | max 500; only when `is_gift` |
| `gift_option_ids` | string[] | | modular add-on ids from site settings `gift.options` (PH-060); **server-priced** |
| `gift_wrap` | bool | | legacy; if true without ids, selects option id `gift_wrap` when enabled |
| `hide_price` | bool | | hide prices on packing slip when gift |
| `scheduled_delivery_date` | RFC3339 | | optional preferred delivery |

**Gift add-ons (PH-060):** selected ids are resolved against **current** public
gift settings. Unknown/disabled id → `422 INVALID_GIFT_OPTION`. Gift mode while
settings `gift.enabled=false` → `422 GIFT_DISABLED`. Fee is snapshotted on the
order as `gift_addons` + `gift_addons_fee` and included in generated
`total_amount` (`subtotal − discount + shipping + tax + gift_addons_fee`).

```json
{
  "address_id": 12,
  "payment_method": "wallet",
  "shipping_method_id": 3,
  "coupon_code": "WELCOME10",
  "notes": "Leave at the front desk",
  "is_gift": true,
  "gift_message": "برای تو ❤️",
  "gift_option_ids": ["gift_wrap", "gift_card"],
  "hide_price": true
}
```

**Response** `201 Created` — `OrderResponse` (includes the full `items` array):

```json
{
  "data": {
    "id": 1042,
    "status": "pending",
    "payment_method": "wallet",
    "subtotal": 120.00,
    "discount_amount": 12.00,
    "shipping_cost": 5.00,
    "tax_amount": 0.00,
    "total_amount": 113.00,
    "notes": "Leave at the front desk",
    "created_at": "2026-06-11T10:00:00Z",
    "items": [
      {
        "id": 5001,
        "product_id": 88,
        "variant_id": 211,
        "product_title": "Single Malt 12yr",
        "image_url": "https://cdn.example.com/p/88.jpg",
        "quantity": 2,
        "unit_price": 60.00,
        "total_price": 120.00
      }
    ]
  }
}
```

**Errors:** `422 VALIDATION_ERROR`, `409 OUT_OF_STOCK`, `422 INVALID_COUPON`, `422 COUPON_EXPIRED`, `401 UNAUTHORIZED`.

---

## List own orders

```
GET /orders
Authorization: Bearer <access_token>
```

Returns a paginated list of the caller's orders as `OrderListItem` summaries. The `user_id` filter is forced to the authenticated user — it cannot be used to view another user's orders.

**Filter params**

| Param | Type | Description |
|-------|------|-------------|
| `status` | string | Filter by order status (e.g. `pending`, `paid`, `shipped`, `cancelled`) |
| `paid_from` | string (date-time) | Only orders paid at or after this time |
| `paid_to` | string (date-time) | Only orders paid at or before this time |

…plus standard pagination/sorting (see [Conventions](../conventions.md)). Default sort is `created_at desc`.

**Response** `200 OK` — paginated `OrderListItem`s:

```json
{
  "results": [
    {
      "id": 1042,
      "status": "pending",
      "payment_method": "wallet",
      "total_amount": 113.00,
      "item_count": 1,
      "created_at": "2026-06-11T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total_items": 1,
    "total_pages": 1,
    "has_next": false,
    "has_prev": false
  }
}
```

**Errors:** `400 INVALID_QUERY`, `401 UNAUTHORIZED`.

---

## Get one of own orders

```
GET /orders/:id
Authorization: Bearer <access_token>
```

Returns a single order owned by the caller, including its `items`. Requesting an id that doesn't exist or belongs to another user returns `404 ORDER_NOT_FOUND`.

**Response** `200 OK` — `OrderResponse` (same shape as [Place an order](#place-an-order)).

**Errors:** `400 INVALID_PARAMS`, `404 ORDER_NOT_FOUND`, `401 UNAUTHORIZED`.

---

## Cancel a pending order

```
POST /orders/:id/cancel
Authorization: Bearer <access_token>
```

Cancels one of the caller's orders. Only orders that have not yet been paid/fulfilled can be cancelled.

**Response** `204 No Content`.

**Errors:** `400 INVALID_PARAMS`, `404 ORDER_NOT_FOUND`, `409 ORDER_CANCELLED` (already cancelled), `409 ORDER_ALREADY_PAID` (too late to cancel), `401 UNAUTHORIZED`.

---

## List all orders (admin)

```
GET /admin/orders
Authorization: Bearer <access_token>   # role = admin
```

Same paginated `OrderListItem` shape as the customer list, but across **all** users. Accepts the additional `user_id` filter to scope to a specific user.

**Filter params**

| Param | Type | Description |
|-------|------|-------------|
| `user_id` | int | Filter to a specific user's orders |
| `status` | string | Filter by order status |
| `paid_from` | string (date-time) | Only orders paid at or after this time |
| `paid_to` | string (date-time) | Only orders paid at or before this time |

…plus standard pagination/sorting (see [Conventions](../conventions.md)). Default sort is `created_at desc`.

**Response** `200 OK` — paginated `OrderListItem`s.

**Errors:** `400 INVALID_QUERY`, `401 UNAUTHORIZED`, `403 INSUFFICIENT_PERMISSIONS`.

---

## Get any order (admin)

```
GET /admin/orders/:id
Authorization: Bearer <access_token>   # role = admin
```

Returns any order by id, including its `items`, regardless of owner.

**Response** `200 OK` — `OrderResponse`.

**Errors:** `400 INVALID_PARAMS`, `404 ORDER_NOT_FOUND`, `401 UNAUTHORIZED`, `403 INSUFFICIENT_PERMISSIONS`.

---

## Update order status (admin)

```
PATCH /admin/orders/:id/status
Authorization: Bearer <access_token>   # role = admin
```

Transitions an order to a new status.

**Request body** — `UpdateOrderStatusReq`

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `status` | string | ✓ | one of `pending` `payment_failed` `paid` `processing` `ready_to_ship` `shipped` `out_for_delivery` `delivered` `refund_requested` `refund_approved` `refunded` `partially_refunded` `cancelled` |

```json
{ "status": "shipped" }
```

**Response** `200 OK` — the updated order as an `OrderListItem` summary:

```json
{
  "data": {
    "id": 1042,
    "status": "shipped",
    "payment_method": "wallet",
    "total_amount": 113.00,
    "item_count": 0,
    "created_at": "2026-06-11T10:00:00Z"
  }
}
```

**Errors:** `400 INVALID_PARAMS`, `422 VALIDATION_ERROR`, `404 ORDER_NOT_FOUND`, `401 UNAUTHORIZED`, `403 INSUFFICIENT_PERMISSIONS`.
