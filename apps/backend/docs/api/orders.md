# Orders


**Implementation (feature slice):** `internal/features/orders/`
Place, list, and inspect orders, cancel pending orders, and manage every order from the admin surface.

See [Authentication](../authentication.md) for the token model and trust tiers, and [Conventions](../conventions.md) for the response/error envelope, pagination, and sorting.

| Method | Path | Tier | Description |
|--------|------|------|-------------|
| POST | `/orders` | 🔒 customer | Place an order |
| GET | `/orders` | 🔒 customer | List own orders |
| GET | `/orders/:id` | 🔒 customer | Get one of own orders |
| POST | `/orders/:id/pay` | 🔒 customer | Start or resume gateway payment |
| POST | `/orders/:id/cancel` | 🔒 customer | Cancel a pending / payment_failed order |
| GET | `/admin/orders` | 🛡️ admin | List all orders |
| GET | `/admin/orders/:id` | 🛡️ admin | Get any order |
| PATCH | `/admin/orders/:id/status` | 🛡️ admin | Update an order's status (not a refund / cancel) |
| POST | `/admin/orders/:id/cancel` | 🛡️ admin | Cancel a pending / payment_failed order (same TX as customer) |
| POST | `/admin/orders/:id/refund` | 🛡️ admin | Refund a paid-like order (wallet + restock + clawback) |

> **Ownership:** customer endpoints are user-scoped — they only ever return the caller's own orders. The owning user is resolved from the authenticated token (`uid`) server-side, so passing another user's order id yields `404 ORDER_NOT_FOUND` rather than someone else's data.

---

## Place an order

```
POST /orders
Authorization: Bearer <access_token>
Idempotency-Key: <uuid-once-per-checkout-intent>   # strongly recommended
```

Creates an order for the authenticated user from their current cart context. Stock is reserved and any coupon is validated at this point. The selected address is **snapshotted** onto the order (`ship_to`: name, phone, lines, city, province, postal, country) together with the shipping method name/carrier and coupon code. Later edits or deletes of the live address book (`address_id` is `ON DELETE SET NULL`) do not change fulfillment.

`payment_method=wallet` settles in the **same create transaction**: wallet debit
(`PurchaseTx`) + `MarkAsPaid` + stock deduct. The response `status` is **`paid`**.
No pending `payment_transactions` row is created. Insufficient wallet balance
returns `409 INSUFFICIENT_FUNDS` and leaves **no** order and **no** committed
stock.

Other payment methods create a **pending** order and insert a pending
`payment_transactions` row **inside the same create transaction**. Settlement
currency is **IRT** (`orders.defaultCurrency`) — same code as wallet/gift
intents and the table default, not `USD`. Multi-currency is not in scope.
If the payment insert fails, the whole order rolls back (no reserved stock
without an intent). The response includes `payment_id`, `transaction_id`, and
`payment_url` (empty when `PAYMENT_START_BASE_URL` is unset). After a
webhook fail or a missing intent, the owner calls `POST /orders/:id/pay`.

**Receipt email (PR-020o):** `POST /orders` does **not** send an “order
confirmed” / receipt email while the order is still `pending`. The receipt
fires after the order is **paid**: wallet checkout (already `paid` on this
response) or `payments.Confirm` after a successful webhook. Copy says paid
and confirmed — not “being processed” on an unpaid create. Email failure
does not undo the order or payment.

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

**Tax (PR-020p):** `tax_amount` = `(subtotal − discount_amount + gift_addons_fee) × 0.08`.
`models.TaxRate` (0.08) is **not** admin-editable. It applies to post-discount
merchandise **plus** selected gift add-on fees (IR VAT-style on the paid add-on).
Shipping is not in the tax base. So `tax + gift + subtotal − discount + shipping`
equals generated `total_amount`.

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

**Response** `201 Created` — `OrderResponse` (includes the full `items` array plus identity / ship-to / method / coupon / payment summary):

```json
{
  "data": {
    "id": 1042,
    "status": "paid",
    "user_id": 7,
    "address_id": 12,
    "shipping_method_id": 3,
    "coupon_id": 8,
    "coupon_code": "WELCOME10",
    "payment_method": "wallet",
    "subtotal": 120.00,
    "discount_amount": 12.00,
    "shipping_cost": 5.00,
    "tax_amount": 0.00,
    "total_amount": 113.00,
    "notes": "Leave at the front desk",
    "created_at": "2026-06-11T10:00:00Z",
    "user": {
      "id": 7,
      "user_id": "11111111-1111-1111-1111-111111111111",
      "first_name": "Ada",
      "last_name": "Lovelace",
      "email": "ada@example.com",
      "phone": "09120000000"
    },
    "address": {
      "full_name": "Ada Lovelace",
      "phone_number": "09120000000",
      "address_line1": "1 Main St",
      "city": "Tehran",
      "state_province": "Tehran",
      "postal_code": "12345",
      "country": "IR"
    },
    "ship_to": {
      "full_name": "Ada Lovelace",
      "phone_number": "09120000000",
      "address_line1": "1 Main St",
      "city": "Tehran",
      "state_province": "Tehran",
      "postal_code": "12345",
      "country": "IR"
    },
    "shipping_method": { "id": 3, "name": "Express", "carrier": "Tipax" },
    "coupon": { "id": 8, "code": "WELCOME10" },
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

`address` and `ship_to` are the same snapshot. Buyer `user` is safe fields only (id, public uuid, name, email, phone — never password or national code). Wallet checkout still omits `payment` / `payment_id` (`omitempty`).

Non-wallet `201` also includes the gateway intent:

```json
{
  "data": {
    "id": 1043,
    "status": "pending",
    "payment_method": "gateway",
    "payment_id": 901,
    "transaction_id": "a1b2c3d4e5f6…",
    "payment_url": "https://pay.example.com/start?transaction_id=a1b2c3d4e5f6…",
    "payment": {
      "id": 901,
      "transaction_id": "a1b2c3d4e5f6…",
      "status": "pending",
      "payment_url": "https://pay.example.com/start?transaction_id=a1b2c3d4e5f6…"
    },
    "total_amount": 113.00,
    "items": []
  }
}
```

`payment_url` is `{PAYMENT_START_BASE_URL}?transaction_id={transaction_id}`.
Empty in development when the env is unset — not paid. Wallet checkout omits
these fields (`omitempty`).

**Errors:** `422 VALIDATION_ERROR`, `409 OUT_OF_STOCK`, `409 INSUFFICIENT_FUNDS` (wallet rail only; no order is kept), `422 INVALID_COUPON`, `422 COUPON_EXPIRED`, `401 UNAUTHORIZED`.

---

## Pay an order (retry / resume)

```
POST /orders/:id/pay
Authorization: Bearer <access_token>
Idempotency-Key: <uuid-once-per-pay-intent>   # strongly recommended
```

Owner-only. Creates a **new** pending payment when the order has no pending
intent or the previous one **failed**. If a pending intent already exists,
returns that same `{payment_id, transaction_id, payment_url}` without inserting
another row.

Refuses when the order is already paid (or any later paid-like status),
cancelled, or `payment_method=wallet` (wallet settles in `POST /orders`).

Same money-route idempotency as place-order (optional `Idempotency-Key`).

**Response** `200 OK` — `OrderResponse` (same shape as [Place an order](#place-an-order), including payment fields).

**Errors:** `400 INVALID_PARAMS`, `404 ORDER_NOT_FOUND`, `409 ORDER_ALREADY_PAID`, `409 ORDER_CANCELLED`, `409 INVALID_STATE` (wallet rail), `401 UNAUTHORIZED`.

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

Returns a single order owned by the caller, including its `items`, the **ship-to snapshot** (`address` / `ship_to`), buyer identity (`user_id` + safe `user`), shipping method, coupon code, optional parcel `tracking_number` / `parcel_carrier` when set (PR-020r), and payment summary when a gateway intent is attached (PR-020f). Requesting an id that doesn't exist or belongs to another user returns `404 ORDER_NOT_FOUND`. Non-wallet orders include the latest gateway intent (`payment_id` / `transaction_id` / `payment_url` and nested `payment`), preferring a still-pending row.

**Response** `200 OK` — `OrderResponse` (same shape as [Place an order](#place-an-order)).

**Errors:** `400 INVALID_PARAMS`, `404 ORDER_NOT_FOUND`, `401 UNAUTHORIZED`.

---

## Cancel a pending order

```
POST /orders/:id/cancel
Authorization: Bearer <access_token>
```

Cancels one of the caller's unpaid orders (`pending` or `payment_failed`).
Paid / fulfilment / refunded orders cannot be cancelled — use
[admin refund](#refund-an-order-admin) after pay.

**One transaction (PR-020j):** `status=cancelled` + `cancelled_at`,
`DELETE` of this order's `coupon_usages` row (restores `MaxUses` /
`MaxUsesPerUser`), and `ReleaseForOrderTx` of reserved stock. A release
error rolls the status and coupon reverse back — it is not swallowed.
Re-release of an already-released reservation is a no-op.

**Response** `204 No Content`.

**Errors:** `400 INVALID_PARAMS`, `404 ORDER_NOT_FOUND` (missing or not
owned), `409 ORDER_CANCELLED` (already cancelled), `409 ORDER_ALREADY_PAID`
(paid or any later status — too late to cancel), `401 UNAUTHORIZED`.

---

## Cancel any unpaid order (admin)

```
POST /admin/orders/:id/cancel
Authorization: Bearer <access_token>   # orders:write
```

Same command as [customer cancel](#cancel-a-pending-order): one TX for
status + coupon reverse + stock release. Owner check is skipped. PATCH
`cancelled` is rejected (`409 INVALID_STATE`).

**Response** `204 No Content`.

**Errors:** `400 INVALID_PARAMS`, `404 ORDER_NOT_FOUND`,
`409 ORDER_CANCELLED`, `409 ORDER_ALREADY_PAID`, `401 UNAUTHORIZED`,
`403 INSUFFICIENT_PERMISSIONS`.

---

## List all orders (admin)

```
GET /admin/orders
Authorization: Bearer <access_token>   # role = admin
```

Paginated `OrderListItem`s across **all** users. Each row additionally carries a
`buyer` object — the same identity `GET /admin/orders/:id` already returns under
the same `orders:read` gate, so triage does not cost a request per order. The
customer's own `GET /orders` never includes it.

```json
"buyer": {
  "id": 42,
  "user_id": "b3f1c2d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
  "first_name": "Ali",
  "last_name": "Rezaei",
  "email": "ali@example.com",
  "phone": "09120000000"
}
```

**Filter params**

| Param | Type | Description |
|-------|------|-------------|
| `user_uuid` | string (uuid) | Filter by the **public** customer id — the one `/admin/users` returns. Prefer this. |
| `user_id` | int | Filter by the internal bigint. Kept for existing callers; no customer-facing response emits this id. |
| `status` | string | Filter by a single order status |
| `statuses` | string | Comma-separated statuses, e.g. `paid,processing,ready_to_ship`. Unknown values are rejected with 400. |
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

Returns any order by id, including its `items`, ship-to snapshot, buyer identity, shipping method, coupon code, optional parcel tracking, and payment summary, regardless of owner. Warehouse fulfillment must use `ship_to` / `address`, not the live address book. `parcel_carrier` is the parcel label, not `shipping_method.carrier` (the rate snapshot).

**Response** `200 OK` — `OrderResponse`.

**Errors:** `400 INVALID_PARAMS`, `404 ORDER_NOT_FOUND`, `401 UNAUTHORIZED`, `403 INSUFFICIENT_PERMISSIONS`.

---

## Update order status (admin)

```
PATCH /admin/orders/:id/status
Authorization: Bearer <access_token>   # role = admin
```

Transitions an order along the **warehouse fulfilment** graph (PR-020l).
This is **not** a money or stock command. Illegal jumps (e.g. `pending` →
`delivered`, `paid` → `delivered`) return `409 INVALID_STATE`.

**Allowed PATCH transitions**

| From | To |
|------|----|
| `paid` | `processing` |
| `processing` | `ready_to_ship`, `shipped` |
| `ready_to_ship` | `shipped` |
| `shipped` | `out_for_delivery`, `delivered` |
| `out_for_delivery` | `delivered` |

Unpaid (`pending`, `payment_failed`) cannot enter fulfilment via PATCH.

**Money / stock statuses are command-only.** The validator still accepts
the enum values; the service then rejects them with `409 INVALID_STATE`:

| PATCH target | Use instead |
|--------------|-------------|
| `paid` | payment settlement (`MarkAsPaid` — webhook / wallet checkout) |
| `cancelled` | `POST /orders/:id/cancel` |
| `refunded`, `partially_refunded`, `refund_approved`, `refund_requested` | `POST /admin/orders/:id/refund` |

**Request body** — `UpdateOrderStatusReq`

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `status` | string | ✓ | one of `pending` `payment_failed` `paid` `processing` `ready_to_ship` `shipped` `out_for_delivery` `delivered` `refund_requested` `refund_approved` `refunded` `partially_refunded` `cancelled` |
| `tracking_number` | string | | optional; max 64; persisted only when `status` is `shipped` or `out_for_delivery` |
| `parcel_carrier` | string | | optional; max 100; persisted only on those same hops. Not the shipping-method rate `carrier`. |

Omitted tracking fields leave any existing labels unchanged. Blank strings store `NULL`. This is **not** a TMS: no events, no carrier API, no required number.

```json
{ "status": "shipped", "tracking_number": "RR123456789IR", "parcel_carrier": "Post" }
```

**Response** `200 OK` — the updated order as an `OrderListItem` summary.
`item_count` is `len` of the order's items (`GetOrderItems`). Optional tracking is echoed when present.

```json
{
  "data": {
    "id": 1042,
    "status": "shipped",
    "payment_method": "wallet",
    "total_amount": 113.00,
    "item_count": 1,
    "created_at": "2026-06-11T10:00:00Z",
    "tracking_number": "RR123456789IR",
    "parcel_carrier": "Post"
  }
}
```

**Errors:** `400 INVALID_PARAMS`, `422 VALIDATION_ERROR`, `404 ORDER_NOT_FOUND`, `409 INVALID_STATE` (illegal transition, or command-only status — use payment settlement / `POST /orders/:id/cancel` or `POST /admin/orders/:id/cancel` / `POST /admin/orders/:id/refund`), `401 UNAUTHORIZED`, `403 INSUFFICIENT_PERMISSIONS`.

---

## Refund an order (admin)

```
POST /admin/orders/:id/refund
Authorization: Bearer <access_token>   # orders:write or orders:refund
```

Runs the real refund command (PR-020d). Empty body. Only **paid-like**
orders may be refunded: `paid`, `processing`, `ready_to_ship`, `shipped`,
`delivered`. `pending`, `cancelled`, `payment_failed`, and refund-family
statuses are refused.

**Side effects (fail-closed, in order):**

1. **Wallet rail** (`payment_method=wallet`, `total_amount > 0`) — credits
   the buyer via `wallet.Refund`. Missing refunder → `409 INVALID_STATE`
   and nothing else runs. Non-wallet tenders **skip** this step: there is
   **no gateway / PSP refund**. Money return for card/crypto/bank/gateway
   is operator/manual.
2. **Restock** — `inventory.AdjustStock` per order line with movement type
   `refund` and a positive quantity (reference = this order).
3. **Loyalty** — `ClawbackOrderEarn` (balance only, lifetime unchanged;
   idempotent at the loyalty layer).
4. **Status** — writes `refunded`. There is no `refunded_at` column.

**Idempotency:** an order that is already `refunded` returns
`409 CONFLICT` (`order is already refunded`) and does **not** credit the
wallet again, restock, or clawback.

**Coupons:** refunds do **not** restore coupon uses. Unpaid cancel
(`POST /orders/:id/cancel` / `POST /admin/orders/:id/cancel`) does
(PR-020j `DeleteByOrderTx`).

**Response** `200 OK` — the refunded order as an `OrderListItem` summary:

```json
{
  "data": {
    "id": 1042,
    "status": "refunded",
    "payment_method": "wallet",
    "total_amount": 113.00,
    "item_count": 0,
    "created_at": "2026-06-11T10:00:00Z"
  }
}
```

**Errors:** `400 INVALID_PARAMS`, `404 ORDER_NOT_FOUND`,
`409 CONFLICT` (already refunded),
`409 INVALID_STATE` (not refundable, or wallet refund unavailable),
`401 UNAUTHORIZED`, `403 INSUFFICIENT_PERMISSIONS`.

