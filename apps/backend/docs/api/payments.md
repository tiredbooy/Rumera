# Payments


**Implementation (feature slice):** `internal/features/payments/`
Read-only admin access to payment transactions. Transactions are **created and transitioned by the order & gateway flow**, not over HTTP — so this surface only lets admins list and look up records. There are no create/update/delete endpoints.

Customer pay-start is not a payments HTTP route. Wallet top-up, gift-card
purchase, and checkout `payments.Create` attach `payment_url` =
`{PAYMENT_START_BASE_URL}?transaction_id={id}` (PR-005a). Operators **must**
set `PAYMENT_START_BASE_URL` in production (config validation fails closed).
Development may omit it; then `payment_url` is empty and the customer cannot
be redirected — that is **not** a successful pay. Order responses do not yet
include this field (PR-020f).

See [Authentication](../authentication.md) for the token model and trust tiers, and [Conventions](../conventions.md) for the response/error envelope.

| Method | Path | Tier | Description |
|--------|------|------|-------------|
| GET | `/admin/payments` | 🛡️ admin | List payment transactions |
| GET | `/admin/payments/:id` | 🛡️ admin | Get a transaction by internal id |
| GET | `/admin/payments/by-transaction/:txid` | 🛡️ admin | Get a transaction by gateway transaction id |

Every endpoint returns `PaymentTransactionAdminResponse`, which extends the customer-facing shape with `user_id` and the raw gateway `raw_response`. Response `user_id` is `users.user_id` (public UUID), the same identity as `GET /admin/customers/:id` (PR-064d). It is omitted when the payment has no user or the public id cannot be resolved. The integer `users.id` is never emitted. The list **filter** `user_id` is still the internal integer id.

**Status** values: `pending`, `succeeded`, `failed`, `refunded`, `partially_refunded`.
**Payment method** values: `card`, `crypto`, `bank_transfer`, `wallet`, `gateway`.

---

## List payment transactions

```
GET /admin/payments
Authorization: Bearer <admin access_token>
```

**Filters** (plus standard pagination/sorting — see [Conventions](../conventions.md)):

| Param | Type | Description |
|-------|------|-------------|
| `user_id` | int | Transactions for a specific user (`users.id`, not the public UUID) |
| `order_id` | int | Transactions for a specific order |
| `status` | string | One of `pending` `succeeded` `failed` `refunded` `partially_refunded` |

**Response** `200 OK` — paginated `results` of `PaymentTransactionAdminResponse`:

```json
{
  "results": [
    {
      "id": 501,
      "order_id": 1200,
      "user_id": "11111111-1111-1111-1111-111111111111",
      "amount": 89.90,
      "currency": "USD",
      "status": "succeeded",
      "payment_method": "card",
      "transaction_id": "ch_3PqR…",
      "paid_at": "2026-06-10T14:31:00Z",
      "created_at": "2026-06-10T14:30:42Z",
      "raw_response": null
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total_items": 1, "total_pages": 1, "has_next": false, "has_prev": false }
}
```

**Errors:** `400 INVALID_QUERY`, `401 UNAUTHORIZED`, `403 INSUFFICIENT_PERMISSIONS`.

---

## Get a transaction by id

```
GET /admin/payments/:id
Authorization: Bearer <admin access_token>
```

`:id` is the internal numeric transaction id.

**Response** `200 OK` — `PaymentTransactionAdminResponse`:

```json
{
  "data": {
    "id": 501,
    "order_id": 1200,
    "user_id": "11111111-1111-1111-1111-111111111111",
    "amount": 89.90,
    "currency": "USD",
    "status": "failed",
    "payment_method": "card",
    "transaction_id": "ch_3PqR…",
    "error_message": "card declined",
    "created_at": "2026-06-10T14:30:42Z",
    "raw_response": "eyJpZCI6…"
  }
}
```

`error_message` and `paid_at` are present only when set; `raw_response` is the base64-encoded gateway payload.

**Errors:** `400 INVALID_PARAMS`, `401 UNAUTHORIZED`, `403 INSUFFICIENT_PERMISSIONS`, `404 NOT_FOUND`.

---

## Get a transaction by gateway transaction id

```
GET /admin/payments/by-transaction/:txid
Authorization: Bearer <admin access_token>
```

`:txid` is the **string** gateway transaction id (e.g. `ch_3PqR…`), useful for reconciling against gateway dashboards or webhooks.

**Response** `200 OK` — `PaymentTransactionAdminResponse` (same shape as above).

**Errors:** `400 INVALID_PARAMS` (empty `:txid`), `401 UNAUTHORIZED`, `403 INSUFFICIENT_PERMISSIONS`, `404 NOT_FOUND`.
