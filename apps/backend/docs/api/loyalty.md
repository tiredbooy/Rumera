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
| GET | `/loyalty` | 🔒 customer | Points balance + tier + `redeem_value` |
| GET | `/loyalty/transactions` | 🔒 customer | Paginated points ledger (`id` / `ref_*`) |
| POST | `/loyalty/redeem` | 🔒 customer | Spend points → wallet credit |
| GET | `/admin/loyalty/programme` | 🛡️ `customers:read` | Effective rates + tiers + `enabled` (DB after seed, PR-003f) |
| PUT | `/admin/loyalty/programme` | 🛡️ `customers:write` | Persist rates / tiers / `enabled` |
| GET | `/admin/loyalty/members` | 🛡️ `customers:read` | Search members (`q`, `tier`, paginated) |
| GET | `/admin/loyalty/members/:userID` | 🛡️ `customers:read` | Member account (`:userID` = public UUID) |
| GET | `/admin/loyalty/members/:userID/transactions` | 🛡️ `customers:read` | Paginated member ledger |
| POST | `/admin/users/:userID/loyalty/adjust` | 🛡️ `customers:write` | Signed grant / clawback (PR-003e) |

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
    "points_to_next": 1500,
    "redeem_value": 1000
  }
}
```

`redeem_value` is Toman of wallet credit per point (PR-003l). Source is the
persisted programme (`loyalty_programme.redeem_value`); missing DB row falls
back to env `LOYALTY_REDEEM_VALUE` (default 1000). Same rate Redeem uses.
Existing account fields are unchanged (additive JSON only).

**Tiers** (by **lifetime** points): `bronze` → `silver` (1000) → `gold` (5000) → `cellar` (20000).

**Errors:** `401`.

---

## List loyalty transactions

```
GET /loyalty/transactions?page=&limit=
Authorization: Bearer <access_token>
```

Paginated ledger for the caller (PR-003j). Same row fields as the admin
member ledger: `id`, `delta`, `reason`, `ref_type`, `ref_id`, `created_at`.

| Parameter | Values |
|-----------|--------|
| `page`, `limit` | Standard pagination (`page` ≥ 1, `limit` 1–100, **default limit 20**) |

**Response** `200 OK` — `{results, pagination}` (not `{data:[]}`):

```json
{
  "results": [
    {
      "id": 91,
      "delta": 50,
      "reason": "order_paid",
      "ref_type": "order",
      "ref_id": "42",
      "created_at": "2026-08-11T10:00:00Z"
    },
    {
      "id": 90,
      "delta": -100,
      "reason": "redeem",
      "ref_type": "redeem",
      "ref_id": "7:idem:client-key-01",
      "created_at": "2026-08-11T11:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total_items": 2,
    "total_pages": 1,
    "has_next": false,
    "has_prev": false
  }
}
```

Empty ledger is `"results": []` with `total_items: 0`. Invalid `page` /
`limit` is `400 INVALID_QUERY` (not an empty list).

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
| `admin_adjust` | live PR-003e | Staff signed grant (+) or clawback (−) |
| `order_clawback` | live PR-003i (full `refunded` status) | Reverse order earn on full refund (balance only) |

**Errors:** `400 INVALID_QUERY`, `401`.

---

## Redeem points for wallet credit

```
POST /loyalty/redeem
Authorization: Bearer <access_token>
Idempotency-Key: <uuid-once-per-redeem-intent>   # required (or body idempotency_key)
```

Spends `points` from the caller's balance and deposits the configured Toman value
into the wallet (`redeem_value` per point from the persisted programme). Points
are spent first; if wallet deposit fails, points are restored (compensating award).
When `enabled` is false the call fails with `LOYALTY_DISABLED` (409).

**Idempotency (PH-011 + PR-003g):** `Idempotency-Key` is **required** (8–128
printable ASCII). A successful 2xx is cached under a **scoped** store key so
double-click / timeout retries do not re-enter the handler. Same key +
different body → `409`. Missing header **and** missing body `idempotency_key`
→ `400 INVALID_REQUEST`. There is no nano-suffix fallback.

**Domain spend key (PR-003g):** ledger `ref_id = "{userID}:idem:{key}"`.
UNIQUE `(reason, ref_type, ref_id)` is global, so the user prefix keeps two
customers with the same client key from colliding. Same user + same key
replays (no second spend / deposit). Earn-on-order remains idempotent per
**order id**.

**Request body** — `RedeemPointsRequest`

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `points` | int | ✓ | min `1` |
| `idempotency_key` | string | ✓ if header omitted | used when `Idempotency-Key` is empty |

```json
{ "points": 100, "idempotency_key": "550e8400-e29b-41d4-a716-446655440000" }
```

**Response** `200 OK` — updated `LoyaltyResponse` (same shape as GET).

**Errors:**

| HTTP | Code (typical) | Meaning |
|------|----------------|---------|
| `400` | `INVALID_REQUEST` | Missing idempotency key |
| `401` | | Unauthorized |
| `409` | `INSUFFICIENT_POINTS` / `LOYALTY_DISABLED` / conflict | Not enough points, programme disabled, or idempotency conflict |
| `422` | | Validation |

---

## Admin programme snapshot (PH-040d / PR-003f)

```
GET /admin/loyalty/programme
Authorization: Bearer <staff_token>
```

Returns the **effective** rates. After seed, the source is
`loyalty_programme` (`config_source: "db"`, `editable: true`). Env
`LOYALTY_*` is seed/fallback only (missing row → `"env"`, `editable: false`).
Existing fields are unchanged; `enabled` is added.

**Response** `200 OK` — `ProgrammeResponse`:

```json
{
  "data": {
    "config_source": "db",
    "editable": true,
    "enabled": true,
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
    "runbook": "Rates and tiers persist in loyalty_programme..."
  }
}
```

**Errors:** `401`, `403`.

Admin UI: `/admin/loyalty` (customers:read).

---

## Admin update programme (PR-003f)

```
PUT /admin/loyalty/programme
Authorization: Bearer <staff_token>
```

Capability is **`customers:write`** (same grant as adjust / wallet credit).
Do **not** invent `loyalty:write`. Not a public grant surface.

**Request body** — `UpdateProgrammeRequest`

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `earn_divisor` | number | ✓ | `> 0` |
| `redeem_value` | number | ✓ | `> 0` |
| `signup_bonus` | int | ✓ | `≥ 0` |
| `review_bonus` | int | ✓ | `≥ 0` |
| `birthday_bonus` | int | ✓ | `≥ 0` |
| `birthday_tz` | string | | IANA; empty → `Asia/Tehran` |
| `referral_reward` | int | ✓ | `≥ 0` (snapshot; referral Complete still uses process env) |
| `enabled` | bool | ✓ | kill-switch |
| `tiers` | array | ✓ | four known ids; `bronze` at 0; strictly increasing |

```json
{
  "earn_divisor": 10000,
  "redeem_value": 1000,
  "signup_bonus": 100,
  "review_bonus": 50,
  "birthday_bonus": 200,
  "birthday_tz": "Asia/Tehran",
  "referral_reward": 300,
  "enabled": true,
  "tiers": [
    { "id": "bronze", "min_lifetime_points": 0 },
    { "id": "silver", "min_lifetime_points": 1000 },
    { "id": "gold", "min_lifetime_points": 5000 },
    { "id": "cellar", "min_lifetime_points": 20000 }
  ]
}
```

**Response** `200 OK` — same `ProgrammeResponse` as GET (`config_source: "db"`).

**Errors:** `401`, `403`, `422` (validation).

When `enabled` is `false`, automated awards skip; redeem and admin
grant/clawback return `409 LOYALTY_DISABLED`. GET account / members /
programme still succeed.

---

## Admin list members (PR-003d)

```
GET /admin/loyalty/members?q=&tier=&page=&limit=
Authorization: Bearer <staff_token>
```

Paginated Cellar Club members (`loyalty_accounts` joined to `users`).
`:userID` / `user_id` is the public UUID (`users.user_id`), same as
`GET /admin/users/:userID` and wallet credit.

| Parameter | Values |
|-----------|--------|
| `q` | Optional. Partial match on email, first name, or last name |
| `tier` | Optional. `bronze`, `silver`, `gold`, `cellar` |
| `page`, `limit` | Standard pagination (`limit` max 100, default 20) |

**Response** `200 OK` — `{results, pagination}` (not `{data:[]}`):

```json
{
  "results": [
    {
      "user_id": "5b2c0000-0000-0000-0000-000000000000",
      "email": "jane@example.com",
      "display_name": "Jane Doe",
      "points_balance": 1200,
      "lifetime_points": 3500,
      "tier": "silver",
      "updated_at": "2026-08-16T10:00:00Z"
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

`display_name` is omitted when first + last name are empty.

**Errors:** `400 INVALID_QUERY`, `401`, `403`.

---

## Admin get member

```
GET /admin/loyalty/members/:userID
Authorization: Bearer <staff_token>
```

`:userID` is a UUID. Unknown user → `404 USER_NOT_FOUND`. A known user
with no `loyalty_accounts` row returns a zero bronze standing.

**Response** `200 OK` — `AdminMemberAccount`:

```json
{
  "data": {
    "user_id": "5b2c0000-0000-0000-0000-000000000000",
    "email": "jane@example.com",
    "display_name": "Jane Doe",
    "points_balance": 1200,
    "lifetime_points": 3500,
    "tier": "silver",
    "next_tier": "gold",
    "points_to_next": 1500,
    "updated_at": "2026-08-16T10:00:00Z"
  }
}
```

**Errors:** `400 INVALID_PARAMS`, `401`, `403`, `404 USER_NOT_FOUND`.

---

## Admin member ledger

```
GET /admin/loyalty/members/:userID/transactions?page=&limit=&reason=
Authorization: Bearer <staff_token>
```

Paginated ledger for the member. Same row shape as customer
`GET /loyalty/transactions` (`id`, `ref_type`, `ref_id`). Optional `reason`
filter is admin-only.

| Parameter | Values |
|-----------|--------|
| `page`, `limit` | Standard pagination (`limit` max 100, default 20) |
| `reason` | Optional exact ledger reason (`order_paid`, `redeem`, …) |

**Response** `200 OK` — `{results, pagination}`:

```json
{
  "results": [
    {
      "id": 91,
      "delta": -100,
      "reason": "redeem",
      "ref_type": "redeem",
      "ref_id": "42:idem:client-key-01",
      "created_at": "2026-08-11T11:00:00Z"
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

**Errors:** `400 INVALID_QUERY` / `INVALID_PARAMS`, `401`, `403`, `404 USER_NOT_FOUND`.

---

## Admin adjust (PR-003e)

```
POST /admin/users/:userID/loyalty/adjust
Authorization: Bearer <staff_token>
Idempotency-Key: <8–128 printable ASCII>   # body key also accepted
```

`:userID` is `users.user_id` (UUID), same as wallet credit and
`GET /admin/loyalty/members/:userID`. Capability is **`customers:write`**
(same grant as `POST /admin/users/:userID/wallet/credit`).

Positive `delta` awards points (`admin_adjust` / `admin` / `{key}`) and
increases `lifetime_points`. Negative `delta` claws back up to the
available balance and **does not** reduce lifetime (refund policy).
`delta` must be a non-zero integer.

**Idempotency:** HTTP money middleware **and** ledger unique
`(reason, ref_type, ref_id)`. Prefer `Idempotency-Key`; the body field
`idempotency_key` is used when the header is empty (wallet-credit
pattern). Same key → **200** replay (no second write). First apply →
**201**. Same key + different body at the HTTP layer → `409`.

Ledger has no actor/note columns. `ref_id` is `{idempotency_key}`
(sha256 when longer than 80 chars) with `|actor={staff_uuid}` appended
when it fits `VARCHAR(80)`. The HTTP payload always returns
`actor_user_id` and `note`.

**Request body** — `AdminAdjustRequest`

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `delta` | int | ✓ | ≠ `0` |
| `note` | string | | max 400 |
| `idempotency_key` | string | ✓ (or header) | 8–128, no whitespace, no `\|` |

```json
{ "delta": 50, "note": "goodwill after delay", "idempotency_key": "ops-adjust-2026-08-16-001" }
```

**Response** `201 Created` (first apply) or `200 OK` (replay) —
`AdminAdjustResult`:

```json
{
  "data": {
    "user_id": "5b2c0000-0000-0000-0000-000000000000",
    "points_balance": 1250,
    "lifetime_points": 3550,
    "tier": "silver",
    "next_tier": "gold",
    "points_to_next": 1450,
    "delta": 50,
    "note": "goodwill after delay",
    "actor_user_id": "11111111-1111-1111-1111-111111111111",
    "idempotency_key": "ops-adjust-2026-08-16-001",
    "ref_type": "admin",
    "ref_id": "ops-adjust-2026-08-16-001|actor=11111111-1111-1111-1111-111111111111",
    "replayed": false,
    "reason": "admin_adjust"
  }
}
```

**Errors:**

| HTTP | Code (typical) | Meaning |
|------|----------------|---------|
| `400` | `INVALID_PARAMS` / `INVALID_REQUEST` | Bad UUID or key |
| `401` | | Unauthorized |
| `403` | | Missing `customers:write` |
| `404` | `USER_NOT_FOUND` | Unknown `:userID` |
| `409` | | Idempotency conflict (same key, different body) |
| `422` | | `delta` is 0, or validation |

---

## Earn rates (ops)

Live rates persist in `loyalty_programme` (PR-003f). Env values below **seed**
the first row and act as last-resort fallback.

| Env (seed) | Default | Role |
|------------|---------|------|
| `LOYALTY_EARN_DIVISOR` | 10000 | Toman per 1 point on paid order |
| `LOYALTY_REDEEM_VALUE` | 1000 | Toman wallet credit per 1 point |
| `LOYALTY_SIGNUP_BONUS` | 100 | Signup points (`0` = off) |
| `LOYALTY_REFERRAL_REWARD` | 300 | Snapshot default (referral Complete still uses env) |
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
