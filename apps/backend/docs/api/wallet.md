# Wallet

**Implementation (feature slice):** `internal/features/wallet/`  
(handler · service · repository · model · mapper · `routes.go`).  
Composed from `internal/routes/routes.go`.

Every customer has exactly one wallet, created automatically on first access.
**Free customer deposit is not exposed.** Balance grows via admin credit, gift-card
redeem, loyalty redeem, refunds, and **gateway top-up** (**PH-041a**).
Self-service withdraw is **removed** (`410 Gone`).

Architecture: [wallet-topup.md](../architecture/wallet-topup.md).

See [Authentication](../authentication.md) for the token model and trust tiers, and
[Conventions](../conventions.md) for the response/error envelope, pagination, and sorting.
Money replay: [idempotency.md](../architecture/idempotency.md) ·
[idempotency-runbook.md](../architecture/idempotency-runbook.md).

| Method | Path | Tier | Description |
|--------|------|------|-------------|
| GET | `/wallet` | 🔒 customer | Get the caller's wallet |
| GET | `/wallet/transactions` | 🔒 customer | List wallet transactions |
| POST | `/wallet/topup` | 🔒 customer | Start gateway top-up (pending payment; not free credit) |
| POST | `/wallet/withdraw` | 🔒 customer | **410 Gone** — self-service withdraw removed |
| GET | `/admin/users/:userID/wallet/transactions` | 🛡️ admin | A customer's wallet ledger — `customers:read` |
| POST | `/admin/users/:userID/wallet/credit` | 🛡️ admin | Credit a customer wallet (idempotent) — `wallet:credit` |

> **Ownership:** customer endpoints operate only on the caller's wallet (from JWT).
> Admin credit targets `:userID` under RBAC (`customers:write`).

---

## Get the wallet

```
GET /wallet
Authorization: Bearer <access_token>
```

Returns the caller's wallet, creating it with a zero balance on first access.

**Response** `200 OK` — `WalletResponse`:

```json
{
  "data": {
    "id": 9,
    "balance": 113.00,
    "created_at": "2026-06-11T10:00:00Z",
    "updated_at": "2026-06-11T10:00:00Z"
  }
}
```

**Errors:** `401 UNAUTHORIZED`.

---

## Gateway top-up (PH-041a)

```
POST /wallet/topup
Authorization: Bearer <access_token>
Idempotency-Key: <uuid-once-per-topup-intent>   # strongly recommended
```

Creates a **pending** `payment_transactions` row with `order_id = null` and a
gateway `transaction_id` (`wtop-…`). **Does not** increase wallet balance.
Balance is credited only when the payment webhook confirms success
(`payments.Confirm` → `wallet.CreditGatewayTopUpTx` in the same DB TX).

**Request body**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `amount` | number | ✓ | `> 0`; must be in **10 000 … 50 000 000** IRT |

```json
{ "amount": 100000 }
```

**Response** `201 Created` — `TopUpResponse`:

```json
{
  "data": {
    "payment_id": 901,
    "transaction_id": "wtop-a1b2c3…",
    "amount": "100000.00",
    "currency": "IRT",
    "status": "pending",
    "payment_url": "https://pay.example.com/start?transaction_id=wtop-a1b2c3…"
  }
}
```

`payment_url` is `{PAYMENT_START_BASE_URL}?transaction_id={transaction_id}`
(PR-005a). Redirect the customer there. The field is present but **empty** when
the base is unset (development only). Production boot **requires**
`PAYMENT_START_BASE_URL` — an empty URL is not a successful pay.

Client may also pay the gateway using `transaction_id` directly. On webhook
success, ledger shows a deposit with description containing
`topup_txid=<transaction_id>`.

**Errors:** `401`, `422` / invalid amount, `409` idempotency conflict, `503` if top-up gateway not wired.

**Not free money:** there is no `POST /wallet/deposit`.

---

## Withdraw (removed)

```
POST /wallet/withdraw
Authorization: Bearer <access_token>
```

**Response** `410 Gone` — free cash-out is not allowed. Do not re-open this path.

---

## List transactions

```
GET /wallet/transactions
Authorization: Bearer <access_token>
```

Returns a paginated ledger of the caller's wallet transactions.

**Filter params**

| Param | Type | Description |
|-------|------|-------------|
| `type` | string | Filter by transaction type: `deposit`, `withdraw`, `purchase`, `refund` |
| `status` | string | Filter by status: `pending`, `completed`, `failed`, `cancelled` |

…plus standard pagination/sorting (see [Conventions](../conventions.md)). Default sort is `created_at desc`.

**Response** `200 OK` — paginated `WalletTransactionResponse`s:

```json
{
  "results": [
    {
      "id": 7781,
      "amount": 50.00,
      "type": "deposit",
      "status": "completed",
      "balance_before": 113.00,
      "balance_after": 163.00,
      "reference_order_id": null,
      "description": "Top-up",
      "created_at": "2026-06-11T10:05:00Z"
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

**Errors:** `400 INVALID_QUERY`, `404 WALLET_NOT_FOUND`, `401 UNAUTHORIZED`.

---

## Admin: read a customer's ledger

```
GET /admin/users/:userID/wallet/transactions
```

Capability **`customers:read`** (or `customers:write`) — deliberately *not* the
`wallet:credit` grant, which mints money. Same paginated shape as the customer
`GET /wallet/transactions`; `:userID` is the public UUID.

**Why this exists (A-10).** The wallet rail settles inside the order transaction
and writes **no `payment_transactions` row** — that is intentional, see
[payments-and-webhooks.md](../architecture/payments-and-webhooks.md). So for a
wallet-paid order the admin payments board is empty and the order detail carries
no `payment` block. This ledger, keyed by `reference_order_id`, is the only
admin trail that purchase has.

## Admin credit

```
POST /admin/users/:userID/wallet/credit
Authorization: Bearer <admin access_token>
Idempotency-Key: <same-as-body-key-recommended>
```

Credits the target user's wallet and writes a ledger row. Requires panel capability
**`customers:write`**. The acting admin UUID is recorded on the ledger description
as `actor=<uuid>` together with `idem=<key>`.

**Two-layer idempotency (PH-011):**

1. **Service truth:** body field `idempotency_key` is **required** (8–128 chars).
   A prior credit with the same key on that wallet returns the existing
   transaction with `"replayed": true` (no second deposit). Header
   `Idempotency-Key` is used as fallback if the body field is empty.
2. **HTTP platform:** money middleware also caches successful 2xx under a scoped
   key when the header is present (`admin:{actorUid}:POST:…`).

Admin UI should generate one UUID per confirm click, put it in **both** body and
header (see storefront/admin wallet credit form).

**Request body** — `AdminCreditReq`

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `amount` | number | ✓ | greater than `0` |
| `description` | string | | max 500 |
| `idempotency_key` | string | ✓ | min 8, max 128; no whitespace/`|` |

```json
{
  "amount": 50000,
  "description": "جبران سفارش",
  "idempotency_key": "ops-credit-2026-08-11-001"
}
```

**Response** `201 Created` (first success) or `200 OK` (service-level replay):

```json
{
  "data": {
    "transaction": {
      "id": 9001,
      "amount": 50000,
      "type": "deposit",
      "status": "completed",
      "description": "… actor=… idem=ops-credit-2026-08-11-001",
      "created_at": "2026-08-11T12:00:00Z"
    },
    "actor_user_id": "7f3e…",
    "idempotency_key": "ops-credit-2026-08-11-001",
    "replayed": false
  }
}
```

**Errors:** `400` / `422` (bad key or amount), `401`, `403`, `404` (user),
`409` (HTTP idempotency body/inflight conflict).

---

## Related

- Gift redeem → wallet: [gift-cards.md](./gift-cards.md)
- Loyalty redeem → wallet: [loyalty.md](./loyalty.md)
- Operator debug: [idempotency-runbook.md](../architecture/idempotency-runbook.md)
