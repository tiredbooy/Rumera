# Loyalty

**Implementation (feature slice):** `internal/features/loyalty/`  
(handler · service · repository · model · `routes.go`).  
Composed from `internal/routes/routes.go`.

**Product rules (earn catalogue, clawback, rates):**  
[architecture/loyalty.md](../architecture/loyalty.md) — **PH-040a**.

Points account, ledger, and redeem-to-wallet. Earn events run inside services —
not free-form HTTP credit.

See [Authentication](../authentication.md) and [Conventions](../conventions.md).
Money replay safety: [idempotency.md](../architecture/idempotency.md) ·
[idempotency-runbook.md](../architecture/idempotency-runbook.md).

| Method | Path | Tier | Description |
|--------|------|------|-------------|
| GET | `/loyalty` | 🔒 customer | Points balance + tier |
| GET | `/loyalty/transactions` | 🔒 customer | Recent points ledger |
| POST | `/loyalty/redeem` | 🔒 customer | Spend points → wallet credit |
| GET | `/admin/loyalty/programme` | 🛡️ `customers:read` | Effective env rates + tiers (read-only, PH-040d) |

Admin **adjust** (grant/clawback) remains designed in architecture/loyalty.md; not mounted.

---

## Get loyalty account

```
GET /loyalty
Authorization: Bearer <access_token>
```

**Response** `200 OK` — `LoyaltyResponse`:

```json
{
  "data": {
    "points_balance": 1200,
    "lifetime_points": 3500,
    "tier": "silver",
    "next_tier": "gold",
    "points_to_next": 1500
  }
}
```

**Tiers** (by **lifetime** points): `bronze` → `silver` (1000) → `gold` (5000) → `cellar` (20000).

**Errors:** `401`.

---

## List loyalty transactions

```
GET /loyalty/transactions
Authorization: Bearer <access_token>
```

Returns recent ledger rows for the caller (delta, reason, timestamps). Limit is
server-fixed (50 today).

**Response** `200 OK` — array of `LoyaltyTransactionResponse`:

```json
{
  "data": [
    {
      "delta": 50,
      "reason": "order_paid",
      "created_at": "2026-08-11T10:00:00Z"
    },
    {
      "delta": -100,
      "reason": "redeem",
      "created_at": "2026-08-11T11:00:00Z"
    }
  ]
}
```

### Reason catalogue

| Reason | Status | Meaning |
|--------|--------|---------|
| `order_paid` | live | Points from settled payment |
| `signup` | live | Welcome bonus |
| `referral` | live | Referrer reward |
| `referral_welcome` | live | Referee reward |
| `redeem` | live | Points spent → wallet |
| `redeem_reversal` | live | Compensating re-award if wallet deposit failed |
| `review` | live PH-040b | Verified-purchase review bonus |
| `birthday` | live PH-040b | Once per year (Asia/Tehran default) |
| `admin_adjust` | planned PH-040d | Staff signed adjustment |
| `order_clawback` | helper ready; wire with refunds | Reverse order earn on full refund |

**Errors:** `401`.

---

## Redeem points for wallet credit

```
POST /loyalty/redeem
Authorization: Bearer <access_token>
Idempotency-Key: <uuid-once-per-redeem-intent>   # strongly recommended
```

Spends `points` from the caller's balance and deposits the configured Toman value
into the wallet (`LOYALTY_REDEEM_VALUE` per point). Points are spent first; if wallet
deposit fails, points are restored (compensating award).

**Idempotency (PH-011):** optional `Idempotency-Key` (8–128 printable ASCII). When
present, a successful 2xx is cached under a **scoped** store key so double-click /
timeout retries do not re-enter the handler. Same key + different body → `409`.
Missing key still processes (no HTTP cache).

**Domain spend key (PH-040b):** when `Idempotency-Key` is present, ledger
`ref_id = "idem:"+key` so domain replay matches HTTP after cache expiry.
Without a key, a nano-suffix ref is used (not client-stable). Prefer always
sending `Idempotency-Key`. Earn-on-order remains idempotent per **order id**.

**Request body** — `RedeemPointsRequest`

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `points` | int | ✓ | min `1` |

```json
{ "points": 100 }
```

**Response** `200 OK` — updated `LoyaltyResponse` (same shape as GET).

**Errors:**

| HTTP | Code (typical) | Meaning |
|------|----------------|---------|
| `401` | | Unauthorized |
| `409` | `INSUFFICIENT_POINTS` / conflict | Not enough points or idempotency conflict |
| `422` | | Validation |

---

## Admin programme snapshot (PH-040d)

```
GET /admin/loyalty/programme
Authorization: Bearer <staff_token>
```

Returns the **effective** rates loaded from process env at boot (not DB).  
`editable` is always `false` until a future DB-backed rates task.

**Response** `200 OK` — `ProgrammeResponse`:

```json
{
  "data": {
    "config_source": "env",
    "editable": false,
    "earn_divisor": 10000,
    "redeem_value": 1000,
    "signup_bonus": 100,
    "review_bonus": 50,
    "birthday_bonus": 200,
    "birthday_tz": "Asia/Tehran",
    "referral_reward": 300,
    "tiers": [
      { "id": "bronze", "min_lifetime_points": 0 },
      { "id": "silver", "min_lifetime_points": 1000 },
      { "id": "gold", "min_lifetime_points": 5000 },
      { "id": "cellar", "min_lifetime_points": 20000 }
    ],
    "runbook": "Rates are process env (LOYALTY_*)..."
  }
}
```

**Errors:** `401`, `403`.

Admin UI: `/admin/loyalty` (customers:read).

---

## Earn rates (ops)

| Env | Default | Role |
|-----|---------|------|
| `LOYALTY_EARN_DIVISOR` | 10000 | Toman per 1 point on paid order |
| `LOYALTY_REDEEM_VALUE` | 1000 | Toman wallet credit per 1 point |
| `LOYALTY_SIGNUP_BONUS` | 100 | Signup points (`0` = off) |
| `LOYALTY_REFERRAL_REWARD` | 300 | Both sides on first paid referral |
| `LOYALTY_REVIEW_BONUS` | 50 | Verified review |
| `LOYALTY_BIRTHDAY_BONUS` | 200 | Birthday |
| `LOYALTY_BIRTHDAY_TZ` | Asia/Tehran | Birthday calendar |
| `CRON_LOYALTY_BIRTHDAY_SCHEDULE` | `0 15 1 * * *` | Daily birthday job (UTC cron) |

Full policy: [architecture/loyalty.md](../architecture/loyalty.md).

---

## Observability (PH-040e)

Prometheus (scrape `GET /metrics`):

| Metric | Labels |
|--------|--------|
| `loyalty_award_total` | `reason`, `result` (`ok`/`replay`/`skip`/`error`) |
| `loyalty_redeem_total` | `result` (`ok`/`replay`/`insufficient`/`error`) |

Analytics event payload schema (reserved for future queue wiring): see
[architecture/loyalty.md § Observability](../architecture/loyalty.md).

---

## Related

- Wallet: [wallet.md](./wallet.md)
- Architecture money sagas: [money-and-stock-sagas.md](../architecture/money-and-stock-sagas.md)
- Loyalty rules design: [loyalty.md](../architecture/loyalty.md)
