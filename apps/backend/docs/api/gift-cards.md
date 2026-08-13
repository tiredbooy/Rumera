# Gift cards

**Implementation (feature slice):** `internal/features/giftcard/`  
(handler · service · repository · model · `routes.go`).  
Composed from `internal/routes/routes.go`.

Staff **issue** codes; customers **purchase** via gateway (PH-042a) and **redeem**
into wallet (single-use). Purchase never credits the buyer wallet — it creates
an active code after payment succeeds.

See [Authentication](../authentication.md) for trust tiers and [Conventions](../conventions.md)
for the response envelope. Money replay safety:
[idempotency.md](../architecture/idempotency.md) ·
[idempotency-runbook.md](../architecture/idempotency-runbook.md).

| Method | Path | Tier | Description |
|--------|------|------|-------------|
| POST | `/gift-cards/purchase` | 🔒 customer | Start gateway purchase (pending; code after paid) |
| GET | `/gift-cards/mine` | 🔒 customer | List codes the caller purchased |
| POST | `/gift-cards/redeem` | 🔒 customer | Redeem a code → wallet credit |
| POST | `/admin/gift-cards` | 🛡️ admin | Issue one or more active codes (staff) |

---

## Purchase a gift card (PH-042a)

```
POST /gift-cards/purchase
Authorization: Bearer <access_token>
Idempotency-Key: <uuid-once-per-purchase-intent>
```

Creates a **pending** payment (`order_id` null, `transaction_id` = `gbuy-…`).
**Does not** issue a code yet. On webhook success, `payments.Confirm` calls
`giftcard.FulfillPaidPurchaseTx` (same TX) and stores `purchase_txid` for
idempotency.

**Amount:** 10 000 … 50 000 000 IRT (same bounds as wallet top-up).

**Request**

```json
{ "amount": 500000 }
```

**Response** `201 Created`

```json
{
  "data": {
    "payment_id": 12,
    "transaction_id": "gbuy-…",
    "amount": "500000.00",
    "currency": "IRT",
    "status": "pending"
  }
}
```

After paid, list codes:

```
GET /gift-cards/mine
```

```json
{
  "data": [
    {
      "code": "ABCD-…",
      "initial_amount": 500000,
      "status": "active",
      "purchase_txid": "gbuy-…",
      "created_at": "…"
    }
  ]
}
```

**Errors:** `401`, `422` (amount), `409` (idempotency), `503` if purchase gateway not wired.

Staff issue path is unchanged (`POST /admin/gift-cards`).

---

## Redeem a gift card

```
POST /gift-cards/redeem
Authorization: Bearer <access_token>
Idempotency-Key: <uuid-once-per-redeem-intent>   # strongly recommended
```

Marks an **active** card as **redeemed** and credits the caller's wallet for the
card's `initial_amount` in a single DB transaction. Already-redeemed / disabled
codes fail; a second redeem of the same code cannot double-credit (domain natural
key: card status).

**Idempotency (PH-011):** optional `Idempotency-Key`. Card status remains the
ultimate truth.

**Request body** — `RedeemGiftCardReq`

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `code` | string | ✓ | non-empty gift-card code |

```json
{ "code": "RUMERA-GIFT-9F8A7B" }
```

**Response** `200 OK` — `RedeemGiftCardResult`:

```json
{
  "data": {
    "amount": 500000
  }
}
```

**Errors:**

| HTTP | Meaning |
|------|---------|
| `401` | Unauthorized |
| `404` / gift invalid | Code not found / not redeemable |
| `409` | Already redeemed, disabled, or idempotency conflict |
| `422` | Validation (missing code) |

---

## Issue gift cards (admin)

```
POST /admin/gift-cards
Authorization: Bearer <admin access_token>
```

Creates `count` active gift cards of the given face amount. **Not** wrapped in the
HTTP money idempotency middleware today (P2). Staff-issued cards have
`purchase_txid = NULL`.

**Request body** — `CreateGiftCardsReq`

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `amount` | number | ✓ | positive face value |
| `count` | int | | 1–500 (default 1) |

```json
{ "amount": 500000, "count": 3 }
```

**Response** `201 Created` — array of `GiftCardResponse` (includes codes).

**Status** values: `active`, `redeemed`, `disabled`.

**Errors:** `401`, `403`, `422`.

---

## Related

- Wallet: [wallet.md](./wallet.md) · top-up: [wallet-topup.md](../architecture/wallet-topup.md)
- Architecture: [money-and-stock-sagas.md](../architecture/money-and-stock-sagas.md)
