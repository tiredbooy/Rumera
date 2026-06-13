# Wallet

Every customer has exactly one wallet, created automatically on first access. View the balance, deposit and withdraw funds, and browse the transaction ledger.

See [Authentication](../authentication.md) for the token model and trust tiers, and [Conventions](../conventions.md) for the response/error envelope, pagination, and sorting.

| Method | Path | Tier | Description |
|--------|------|------|-------------|
| GET | `/wallet` | 🔒 customer | Get the caller's wallet |
| POST | `/wallet/deposit` | 🔒 customer | Deposit funds |
| POST | `/wallet/withdraw` | 🔒 customer | Withdraw funds |
| GET | `/wallet/transactions` | 🔒 customer | List wallet transactions |

> **Ownership:** all endpoints operate on the wallet belonging to the authenticated user (resolved from the token), created on demand via get-or-create. There is no way to read or modify another user's wallet.

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

## Deposit

```
POST /wallet/deposit
Authorization: Bearer <access_token>
```

Credits the caller's wallet and records a `deposit` transaction.

**Request body** — `DepositReq`

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `amount` | number | ✓ | greater than `0` |
| `description` | string | | optional |

```json
{ "amount": 50.00, "description": "Top-up" }
```

**Response** `201 Created` — `WalletTransactionResponse`:

```json
{
  "data": {
    "id": 7781,
    "amount": 50.00,
    "type": "deposit",
    "status": "completed",
    "balance_before": 113.00,
    "balance_after": 163.00,
    "description": "Top-up",
    "created_at": "2026-06-11T10:05:00Z"
  }
}
```

**Errors:** `422 VALIDATION_ERROR`, `404 WALLET_NOT_FOUND`, `401 UNAUTHORIZED`.

---

## Withdraw

```
POST /wallet/withdraw
Authorization: Bearer <access_token>
```

Debits the caller's wallet and records a `withdraw` transaction. Fails if the balance is insufficient.

**Request body** — `WithdrawReq`

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `amount` | number | ✓ | greater than `0` |
| `description` | string | | optional |

```json
{ "amount": 20.00, "description": "Refund to card" }
```

**Response** `201 Created` — `WalletTransactionResponse` (same shape as deposit, with `"type": "withdraw"`).

**Errors:** `422 VALIDATION_ERROR`, `409 INSUFFICIENT_FUNDS`, `404 WALLET_NOT_FOUND`, `401 UNAUTHORIZED`.

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
