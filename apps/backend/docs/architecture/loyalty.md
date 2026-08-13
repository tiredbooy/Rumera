# Loyalty (Cellar Club) — product rules design

**Who this is for:** engineers implementing earn/redeem triggers (PH-040b+),
product/ops defining rates and abuse policy.

**Status:** **PH-040a design + PH-040b implementation** (2026-08-12). Earn triggers
for review and birthday are wired; redeem domain keys bind to HTTP
`Idempotency-Key`; order clawback helper is ready for refund saga. Admin adjust
API remains PH-040d. No free money; awards are service-only.

**API surface:** [api/loyalty.md](../api/loyalty.md)  
**Money sagas:** [money-and-stock-sagas.md](./money-and-stock-sagas.md)  
**Idempotency:** [idempotency.md](./idempotency.md)

---

## 1. Programme summary

| Concept | As-built |
|---------|----------|
| Unit | Integer **points** (not Toman) |
| Balance | `loyalty_accounts.points_balance` ≥ 0 |
| Lifetime | `lifetime_points` — cumulative **positive** awards only (not reduced by redeem) |
| Tier | Derived from lifetime: bronze → silver → gold → cellar |
| Ledger | Append-only `loyalty_transactions` with **UNIQUE (reason, ref_type, ref_id)** |
| Redeem | Points → wallet deposit at fixed Toman/point; compensating re-award on deposit fail |
| Config | Process env `LOYALTY_*` (not DB today) |

**Invariants**

1. **No public “grant points” HTTP** — only redeem + reads on customer API.  
2. **Earn after real side effects** (paid order, verified signup, …) — never on cart/order create alone.  
3. **Idempotent awards** via ledger unique key; retried webhooks must not double-grant.  
4. **Payment confirm never fails because of loyalty** — earn is best-effort after the money TX commits.  
5. **Balance never negative** (DB check + spend guard).  
6. **Currency remains Toman** — points valuation is Toman per point in config; no multi-currency.

---

## 2. Configuration (rates)

### Live env (today)

| Env | Default | Meaning |
|-----|---------|---------|
| `LOYALTY_EARN_DIVISOR` | `10000` | Order Toman per **1** point earned (`floor(amount / divisor)`) |
| `LOYALTY_REDEEM_VALUE` | `1000` | Wallet Toman credit per **1** point redeemed |
| `LOYALTY_SIGNUP_BONUS` | `100` | One-time points on account creation (`0` = off) |
| `LOYALTY_REFERRAL_REWARD` | `300` | Points to **both** referrer and referee on first paid order |

### Live env (PH-040b)

| Env | Default | Meaning |
|-----|---------|---------|
| `LOYALTY_REVIEW_BONUS` | `50` | Points per verified-purchase review (`0` = off) |
| `LOYALTY_BIRTHDAY_BONUS` | `200` | Points once per calendar year (`0` = off) |
| `LOYALTY_BIRTHDAY_TZ` | `Asia/Tehran` | Calendar day for birthday match (IANA) |
| `CRON_LOYALTY_BIRTHDAY_SCHEDULE` | `0 15 1 * * *` | Daily birthday job (6-field UTC cron) |

### Env vs DB-configurable (decision for PH-040d)

| Option | Status | Notes |
|--------|--------|-------|
| **Env-only** | **Chosen (PH-040d)** | Rates stay process env; restart to change |
| **Admin UI** | **Read-only shipped** | `GET /admin/loyalty/programme` + FE `/admin/loyalty` |
| **DB rates later** | Deferred | Prefer dedicated keys later — **not** storefront `site_settings` |

**PH-040d decision:** keep env source of truth; operators see effective snapshot + runbook in admin. No free grant / rate-edit API.

---

## 3. Tiers (as-built — keep)

Thresholds on **lifetime_points** (not current balance):

| Tier | Lifetime ≥ | Next |
|------|------------|------|
| `bronze` | 0 | silver at 1 000 |
| `silver` | 1 000 | gold at 5 000 |
| `gold` | 5 000 | cellar at 20 000 |
| `cellar` | 20 000 | top (no next) |

API exposes `tier`, `next_tier`, `points_to_next` (see loyalty API).  
**No tier multiplies earn rate** in v1 (flat programme). Future multiplier is out of scope unless product asks.

---

## 4. Earn catalogue

### Ledger key rules

`UNIQUE (reason, ref_type, ref_id)` is **global** (not per-user). Therefore:

- `ref_id` must be **globally unique** for that reason/type (include `user_id` when the natural key is not global).
- Replays with the same triple are no-ops (`ON CONFLICT DO NOTHING`).
- Do not reuse a `ref_id` for a different user or amount.

### 4.1 Order paid — **LIVE**

| | |
|--|--|
| **When** | After payment **Confirm** TX commits (stock deducted + order paid) |
| **Where** | `payments.Service.Confirm` → `loyalty.AwardForOrder` |
| **Amount** | `floor(payment_amount / LOYALTY_EARN_DIVISOR)`; skip if ≤ 0 |
| **Reason / ref** | `order_paid` / `order` / `{orderID}` |
| **Idempotent** | Yes — order id |
| **Failure** | Best-effort log; must not roll back payment |
| **Base amount** | Gateway/`payment_transactions.amount` (as today) — not a recomputed cart |

**Guest checkout:** only if `user_id` is present on the payment; guests without accounts earn nothing.

### 4.2 Signup bonus — **LIVE**

| | |
|--|--|
| **When** | Password register and OTP signup create a new user |
| **Where** | `auth` handlers → `AwardSignup` |
| **Amount** | `LOYALTY_SIGNUP_BONUS` |
| **Reason / ref** | `signup` / `user` / `{userID}` |
| **Idempotent** | Yes — once per user |

### 4.3 Referral — **LIVE**

| | |
|--|--|
| **When** | Referee’s **first paid** order completes a pending referral |
| **Where** | `referral.OnPaidOrder` after payment confirm |
| **Amount** | `LOYALTY_REFERRAL_REWARD` to **referrer** and **referee** |
| **Reason / ref** | `referral` + `referral_welcome` / `referral` / `{referralRowID}` |
| **Idempotent** | Complete-once row + ledger unique |
| **Anti-abuse** | No self-referral; one referral edge per referee; unknown codes ignored |

### 4.4 Review submitted — **LIVE (PH-040b)**

| | |
|--|--|
| **When** | After successful `reviews.Service.Create` |
| **Where** | `AwardForReview` best-effort after insert |
| **Eligibility** | **Verified purchase only**. Non-buyer reviews earn 0. |
| **Once rules** | One review per (user, product). Award once per **review id**. |
| **Amount** | `LOYALTY_REVIEW_BONUS` (fixed; `0` disables) |
| **Reason / ref** | `review` / `review` / `{reviewID}` |
| **Moderation** | Award on **create**, not on admin approve |
| **Failure** | Best-effort; review create must not fail if loyalty fails |

### 4.5 Birthday bonus — **LIVE (PH-040b)**

| | |
|--|--|
| **When** | Cron `loyalty_birthday` (`CRON_LOYALTY_BIRTHDAY_SCHEDULE`) |
| **Where** | `Service.RunBirthdayAwards` |
| **Timezone** | `LOYALTY_BIRTHDAY_TZ` default **`Asia/Tehran`** |
| **Eligibility** | `is_active` and not banned, non-null `birth_date` |
| **Once rules** | **Once per calendar year** per user |
| **Amount** | `LOYALTY_BIRTHDAY_BONUS` |
| **Reason / ref** | `birthday` / `user` / `{userID}:{YYYY}` |
| **29 Feb** | On 28 Feb non-leap years, also awards Feb 29 birthdays |
| **Failure** | Per-user best-effort; job continues |

### 4.6 Admin adjustment — **PLANNED (PH-040b or 040d)**

| | |
|--|--|
| **When** | Staff action only |
| **API (planned)** | `POST /admin/users/:id/loyalty/adjust` — **not** a free public credit |
| **Body (planned)** | `{ "delta": ±int, "note": "…", "idempotency_key": "…" }` — do not invent fields until implement |
| **Capability** | Reuse `customers:write` or add `loyalty:write` (prefer explicit `loyalty:write` if RBAC matrix is cheap) |
| **Reason / ref** | `admin_adjust` / `admin` / `{idempotency_key}` (global unique; include staff id in note metadata if needed later) |
| **Positive delta** | Increases balance + lifetime |
| **Negative delta** | Clawback path: reduce balance up to available; **do not** reduce lifetime (mirrors refund policy) |
| **Audit** | Ledger row is the audit; `note` may need a column later — v1 can encode short note in `ref_id` prefix or add `meta` in a follow-up migration |

---

## 5. Redeem (as-built + PH-040b hardening)

### Today

1. Validate `points >= 1`.  
2. `Spend` decreases balance if sufficient; ledger `redeem` / `redeem` / `{userID}-{nanos}`.  
3. Wallet `Deposit` for `points * LOYALTY_REDEEM_VALUE`.  
4. On deposit failure → compensating `Award` `redeem_reversal` / `redeem` / same ref.

### PH-040b domain spend key

| Behaviour | Detail |
|-----------|--------|
| HTTP key present | Ledger `ref_id = "idem:"+Idempotency-Key`; spend insert is idempotent; replay skips second wallet deposit |
| Missing key | Fallback `{userID}-{nanos}` (not client-stable) |
| Race | Ledger claim then balance update under TX |

---

## 6. Cancel / refund clawback — **POLICY (PH-040b implement with refund path)**

Order refunds/returns are incomplete product-wide (BACKEND-IMPROVEMENTS #18). Loyalty policy when a **paid order is refunded**:

| Rule | Decision |
|------|----------|
| Claw back earn? | **Yes** — attempt to reverse `order_paid` points for that order |
| Amount | Equal to original award delta for that order (read from ledger row) |
| Lifetime | **Do not decrease** lifetime_points or auto-demote tier |
| Balance shortfall | Deduct `min(balance, original_award)`; never negative; residual is written off (ops accept) |
| Ledger | `order_clawback` / `order` / `{orderID}` — idempotent |
| Timing | Same side-effect point as wallet/stock refund when that saga is wired |
| Partial refund | v1: full clawback only on **full** order refund; partial refund clawback deferred |

Until refund saga exists, document policy only — no orphan clawback job.

---

## 7. Anti-abuse summary

| Vector | Control |
|--------|---------|
| Double webhook | Ledger unique + payment terminal ACK |
| Fake reviews | Verified-purchase-only earn + one review per product |
| Birthday spam | Once per year key; require `birth_date` |
| Self-referral | Blocked in referral claim |
| Free points API | Not exposed |
| Redeem spam | HTTP idempotency + balance guard |
| Inflated order amount | Earn uses settled payment amount only |

Optional later (not PH-040b): daily earn caps, velocity limits, manual fraud freeze flag on account.

---

## 8. Side-effect map (implementers)

```
Payment Confirm commit
  → AwardForOrder (live)
  → referral.OnPaidOrder (live)

Auth register / OTP new user
  → AwardSignup (live)

reviews.Create success
  → AwardForReview if verified_purchase (live PH-040b)

Cron loyalty_birthday (daily; awards in LOYALTY_BIRTHDAY_TZ)
  → RunBirthdayAwards (live PH-040b)

Admin adjust (PH-040d)
  → Award or clawback with admin key

Order full refund saga (future)
  → ClawbackOrderEarn (helper ready)
```

---

## 9. Observability (PH-040e)

### Prometheus (live)

| Metric | Labels | Meaning |
|--------|--------|---------|
| `loyalty_award_total` | `reason`, `result` | Award attempts |
| `loyalty_redeem_total` | `result` | Redeem attempts |

**`reason`** (low cardinality): `order_paid`, `signup`, `referral`, `referral_welcome`,
`review`, `birthday`, `admin_adjust`, `order_clawback`, `redeem_reversal`, …

**`result` (award):** `ok` (new grant), `replay` (idempotent no-op), `skip` (zero/disabled/ineligible), `error`

**`result` (redeem):** `ok`, `replay` (same Idempotency-Key), `insufficient`, `error`

Scrape: `GET /metrics` (see [observability.md](./observability.md)).

### Analytics events (schema reserved; queue wiring optional)

Future `events.event_type` values for programme health dashboards. **Do not invent
FE/admin API fields** until a consumer exists. Payload is JSON in analytics DB.

#### `loyalty_earned`

| Field | Type | Notes |
|-------|------|--------|
| `user_id` | int64 | Internal users.id (or omit if only session) |
| `delta` | int | Points granted (>0) |
| `reason` | string | Same as ledger reason |
| `ref_type` | string | e.g. `order`, `review`, `user` |
| `ref_id` | string | Natural key |
| `replay` | bool | true if ledger unique conflict (no balance change) |

#### `loyalty_redeemed`

| Field | Type | Notes |
|-------|------|--------|
| `user_id` | int64 | |
| `points` | int | Absolute points spent |
| `wallet_credit_toman` | number | `points * redeem_value` |
| `replay` | bool | Domain idempotency hit |

**Emitter rule (when wired):** best-effort after ledger commit; never fail money/earn path if analytics queue is full (drop + log). Use `internal/analytics.Queue.Push` with a synthetic session if needed, or a dedicated server-side event path.

**PH-040e shipped metrics only** — analytics insert is documented for PH-050 / admin analytics later.

---

## 10. Implementation checklist → PH-040b

1. [x] Env review/birthday (+ timezone); wired into `loyalty.Service`  
2. [x] `AwardForReview` + reviews.Create best-effort  
3. [x] Birthday cron `loyalty_birthday` + `ListBirthdayUserIDs`  
4. [x] Redeem `ref_id` from HTTP `Idempotency-Key` when present  
5. [x] Unit tests (review verified-only, birthday key, clawback, redeem replay)  
6. [x] Dual-doc API reasons  
7. [ ] Admin adjust API → **PH-040d**  
8. [x] `ClawbackOrderEarn` helper (unit-tested; wire when refund saga lands)

---

## 11. Explicit non-goals

- Multi-currency points valuation  
- Netflix-style subscription entitlements  
- Tier-based checkout discounts (unless separate product task)  
- Storefront calling Meili or inventing earn client-side  
- Free wallet deposit disguised as loyalty  

---

## Related

- Code: `internal/features/loyalty/`, `referral/`, `payments/service.go` Confirm, `auth` signup  
- Users: `birth_date` on `users`  
- FE: `features/loyalty/` account rewards UI  
