# Idempotency platform (production-grade)

**Status:** **PH-011 complete** (011a–e). Platform + mounts + UNIQUE tx id + runbook.  
**Program:** `refactor-workstreams/production-hardening-and-product/`  
**Runbook:** [idempotency-runbook.md](./idempotency-runbook.md)  
**Obsidian:** `11 Decisions/ADR Idempotency platform.md` ·  
`09 Journeys/Journey Idempotent retry checkout webhook.md` ·  
`12 Playbooks/Playbook Debug Idempotency.md`

This document is the **source of depth** for how Rumera makes money and create
mutations safe under client retries, double-clicks, and at-least-once gateway
delivery. Full PH-011 platform is shipped; operator steps live in the runbook.

---

## 1. Why this exists

HTTP clients and payment gateways are **at-least-once**:

- Mobile/FE retries after timeout while the server already committed.
- Double-submit on slow checkout.
- Gateway webhook redelivery of the same success payload.

Without a stable platform, retries create **double orders, double wallet
credits, double gift-card burns, or double loyalty spends**.

Related sagas: [money-and-stock-sagas.md](./money-and-stock-sagas.md) (Saga F).  
Related payments: [payments-and-webhooks.md](./payments-and-webhooks.md).

---

## 2. As-built inventory (PH-011b + PH-011c)

### 2.1 HTTP platform (middleware)

| Piece | Location | Notes |
| --- | --- | --- |
| Middleware | `pkg/middleware/idempotency.go` | Scoped keys; Claim → handler → Complete (2xx) / Release (non-2xx) |
| Config | `Idempotency` / `IdempotencyWithConfig` | Webhook: `AllowAutoKey=true`. Money: `AllowAutoKey=false`, `RequireKey=false` (until FE always sends keys) |
| Store | Postgres `idempotency_keys` | Migration `20260614130000_create_idempotency_keys.sql` |
| Stale reclaim | `NewIdempotencyStore` | Pending rows older than **2m** (`DefaultIdempotencyStaleAfter`) may be reclaimed on Claim |
| Wire | `internal/bootstrap/newRouter.go` | One store; **two** policies: `webhookIdem` + `moneyIdem` → `routes.Setup` |
| Applied to | **P0 money routes (011c)** — see table below | Feature `Register*` accept optional middleware |
| Cleanup | `internal/corn/idempotency_cleanup_job.go` | Cron prunes by `created_at` (retention) |
| Retention env | `IDEMPOTENCY_KEY_RETENTION` | Default **720h (30 days)** |
| Metrics | `pkg/metrics` | `idempotency_*` counters (see § metrics below) |
| Unit tests | `pkg/middleware/idempotency_test.go` | Replay, conflict, inflight, scoped principals, stale reclaim, races |
| Route tests | `internal/routes/idempotency_money_test.go` | Double-POST one side effect on all P0 paths; missing-key pass-through; Register* wiring |

**Table shape**

```text
idempotency_keys (
  key           TEXT PRIMARY KEY,       -- scoped string (see D2), not raw client key
  request_hash  TEXT NOT NULL,          -- sha256 hex of raw body
  response_code INT  NOT NULL DEFAULT 0, -- 0 = in flight
  response_body BYTEA,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
INDEX idx_idempotency_keys_created_at (created_at)
```

**Key derivation (PH-011b)**

1. **Client key:** header `Idempotency-Key` when present (8–128 printable ASCII, no whitespace/`|`); else if `AllowAutoKey` → `auto:{bodyHash}`; else skip platform (or 400 if `RequireKey`).
2. **Stored PK (scoped):** `{tier}:{principal}:{METHOD}:{routeTemplate}:{clientKey}`  
   - `tier`: `wh` / `admin` / `cust` / `pub` from path + `uid` context  
   - `principal`: JWT `uid` string, or `0` when unauthenticated  
   - `routeTemplate`: Gin `FullPath()` (e.g. `/api/v1/webhooks/payment`)

**Behaviours**

| Case | Response |
| --- | --- |
| First claim, handler returns 2xx | Store status + body; replay returns same |
| First claim, handler returns non-2xx | **Release** claim (retry allowed) |
| Replay same scoped key + same body hash, completed | Return stored response; **handler not run** |
| Same scoped key, different body hash | **409** `idempotency key reused with a different payload` |
| Same scoped key, still in flight and **not** stale | **409** `request already in progress` |
| Pending claim older than stale lease (default 2m) | **Reclaim** → new claim wins; handler runs |
| Store Claim/Complete/Release errors | **Fail-open** (log warn, proceed) |

**Metrics (local Prometheus)**

| Metric | Labels | Meaning |
| --- | --- | --- |
| `idempotency_claim_total` | `result=won\|lost\|error` | Claim outcomes |
| `idempotency_replay_total` | — | Stored response returned |
| `idempotency_conflict_total` | `reason=body\|inflight` | 409s |
| `idempotency_complete_error_total` | — | Failed to persist 2xx |
| `idempotency_missing_key_total` | `route` | Key omitted when auto disabled |

### 2.2 Service-level / natural-key protections (not the HTTP store)

| Mechanism | Where | Protection |
| --- | --- | --- |
| Admin wallet credit key | `wallet.Service.AdminCredit` | Body/header key embedded in ledger description `idem=<key>`; lookup before deposit |
| Admin loyalty adjust | `loyalty.Service.Adjust` | Body/header key as ledger `ref_id` (`admin_adjust` / `admin` / `{key}`); lookup before award/clawback |
| Loyalty award | `loyalty.Service.AwardForOrder` | Idempotent per **order id** (ledger / award key) |
| Gift-card redeem | `giftcard.RedeemAndCredit` | Card row lock + status transition; one credit per code |
| Payment Confirm/Fail | `payments` service | Only transitions **pending** rows → no double deduct on already-settled |
| Notification outbox | `notification_outbox` / deliveries | Separate `idempotency_key` UNIQUE — **not** HTTP money middleware |
| Product aggregate ops | cleaned with same cron retention | Ops ledger cleanup, not money |

### 2.3 Gateway transaction identity (as-built PH-011d)

| Item | Status |
| --- | --- |
| `payment_transactions.transaction_id` | `NOT NULL` + **UNIQUE** index `uq_payment_transactions_transaction_id` |
| Migration | `20260811180000_payment_transaction_id_unique.sql` — dedupe (prefer succeeded), drop non-unique `idx_payment_transactions_txid`, `CREATE UNIQUE INDEX CONCURRENTLY` |
| Create path | Repo maps Postgres `23505` → `models.ErrConflict`; service → `apperr.ErrConflict` |
| Webhook replay | Confirm/Fail pending-only; if not pending but row is **terminal**, handler **200 ACK** `{received, replayed:true}` so gateways stop without double side effects |
| Webhook auto-key | Body hash of full JSON → same payload redelivery also deduped at HTTP layer |
| Tests | `payments/webhook_test.go` (HTTP replay ACK), `service_test.go` (unique conflict), integration `TestPaymentTransactionID_Unique` |

---

## 3. Money & create-mutation route catalogue

Priority **P0** = must be platform-protected before more wallet/gift product work.  
**P1** = should. **P2** = nice / natural key may suffice. **Out** = not money side-effect.

Prefix all paths with `/api/v1` unless noted. Customer routes sit under JWT;
admin under JWT + RBAC.

| # | Method · path | Side effect | As-built protection (011c) | Residual | P |
| --- | --- | --- | --- | --- | --- |
| 1 | `POST /webhooks/payment` | Confirm/Fail payment, order paid, stock deduct/release, loyalty/referral best-effort | **HTTP** auto-key + **UNIQUE** `transaction_id` + pending-only; terminal ACK 200 | Runbook shipped | P0 |
| 2 | `POST /orders` | Order + items + coupon usage + **inventory reserve** + pending payment | **HTTP** money policy (optional `Idempotency-Key`, no auto) + atomic TX | FE must send keys for replay safety; RequireKey later | P0 |
| 3 | `POST /orders/:id/cancel` | Cancel + release stock | Domain state machine | Optional HTTP key later | P1 |
| 4 | `POST /admin/users/:userID/wallet/credit` | Wallet deposit + ledger | **HTTP** money policy **+** service-level ledger `idem=<key>` | Keep both layers | P0 |
| 4b | `POST /admin/users/:userID/loyalty/adjust` | Points grant/clawback + ledger | **HTTP** money policy **+** ledger `admin_adjust` / `admin` / `{key}` | Keep both layers | P1 |
| 5 | `POST /gift-cards/redeem` | Burn card + wallet credit (one TX) | **HTTP** money policy + natural key (code status) | Natural key remains ultimate | P0 |
| 6 | `POST /admin/gift-cards` | Issue N codes | None at HTTP | Optional middleware for double-click issue | P2 |
| 7 | `POST /subscriptions` | Create cellar-box subscription row | None | HTTP middleware (customer-scoped) | P1 |
| 8 | `PATCH /subscriptions/:id` | Pause/resume/cancel/skip | Domain state | Domain guards sufficient unless action is non-idempotent | P2 |
| 9 | `POST /loyalty/redeem` | Spend points | **HTTP** money policy + domain `{userID}:idem:{key}` (PR-003g; key required) | Missing key → `400` | P0 |
| 10 | `POST /referrals/claim` | Attach referral | Domain uniqueness likely | Confirm uniqueness; add key if claim can double-reward | P1 |
| 11 | `POST /coupons/validate` | Read-only validate | n/a | Out of platform (no money write) | Out |
| 12 | `POST /wallet/withdraw` | **410 Gone** | Removed | Stay gone; no re-open free cash | Out |
| 13 | `POST /wallet/topup` | Pending gateway payment for wallet charge | **HTTP** money policy + UNIQUE `transaction_id` + Confirm wallet credit marker | PH-041a | P0 |
| 14 | `POST /gift-cards/purchase` | Pending `gbuy-*` payment; issue card on Confirm | **HTTP** money + UNIQUE tx id + `purchase_txid` | PH-042a | P0 |
| 13 | Customer wallet top-up (future) | Gateway pay → webhook credit | Does not exist | **PH-041** depends on this platform | P0 (future) |
| 14 | Customer gift-card purchase (future) | Pay → issue code | Does not exist | **PH-042** depends on this platform | P0 (future) |
| 15 | `PATCH /admin/orders/:id/status` | Ops status / refund-related | RBAC + domain | Domain + refund playbook; not generic middleware first | P1 |
| 16 | Cart mutations | Cart lines only | User-scoped | Out of money platform (no ledger) | Out |

**Bootstrap wiring (PH-011c)**

```text
newRouter:
  store := NewIdempotencyStore(db)
  webhookIdem := Idempotency(store)                              // AllowAutoKey=true
  moneyIdem   := IdempotencyWithConfig(store, {AllowAutoKey:false, RequireKey:false})
  routes.Setup(..., webhookIdem, moneyIdem)

features:
  payments.RegisterPublic(v1, h, webhookIdem)           → POST /webhooks/payment
  orders.RegisterCustomer(c, h, moneyIdem)              → POST /orders
  giftcard.RegisterCustomer(c, h, moneyIdem)            → POST /gift-cards/redeem
  loyalty.RegisterCustomer(c, h, moneyIdem)             → POST /loyalty/redeem
  wallet.RegisterAdmin(a, h, moneyIdem)                 → POST /admin/users/:userID/wallet/credit
  loyalty.RegisterAdmin(read, write, h, moneyIdem)      → POST /admin/users/:userID/loyalty/adjust
```

**Coupon apply at checkout** is inside `POST /orders` (FOR UPDATE under order TX) —
covered by protecting order create, not a separate public “apply coupon” write.

---

## 4. Design decisions (ADR)

### D1 — Header name

Use **`Idempotency-Key`** (industry standard, already used by wallet admin + middleware).

- Allowed charset for **client-supplied** keys: printable ASCII without whitespace or `|` (align with admin wallet rules: length **8–128**).
- Clients (checkout, redeem, admin credit UI) generate a **UUID v4** (or ULID) **once per user intent**, store in session/local state, and resend on retry.

### D2 — Key scope (critical fix for PH-011b)

Today the middleware uses the **raw header as a global primary key**. That is
unsafe for multi-tenant/user: two customers must not collide on the same UUID
string, and a customer must not replay another user’s cached response.

**Target stored key**

```text
{tier}:{principal}:{METHOD}:{routeTemplate}:{clientKey}
```

| Part | Rule |
| --- | --- |
| `tier` | `pub` · `cust` · `admin` · `wh` |
| `principal` | JWT `uid` string, or `0` for unauthenticated webhook, or admin actor uid for admin routes |
| `METHOD` | Uppercase HTTP method |
| `routeTemplate` | Gin full path template (e.g. `/api/v1/orders`, not numeric ids) where available; for webhook use fixed `/api/v1/webhooks/payment` |
| `clientKey` | Header value, or `auto:{bodyHash}` when header omitted **and** auto is allowed |

Examples:

```text
wh:0:POST:/api/v1/webhooks/payment:auto:a1b2…
cust:42:POST:/api/v1/orders:550e8400-e29b-41d4-a716-446655440000
admin:7:POST:/api/v1/admin/users/:userID/wallet/credit:ops-credit-2026-08-11-001
```

**Webhook without header** keeps auto-derive (body identity) so gateways that
cannot send custom headers still dedupe identical payloads.

**Authenticated money routes (PH-011c):** require explicit `Idempotency-Key`
header (or documented body field) — **do not** auto-derive from body alone for
`POST /orders`, because two intentional places with same cart snapshot must not
collapse if the client intentionally omitted a key… *Alternatively:* if header
missing, process **without** platform cache (fail-open to current behaviour) and
log a metric `idempotency_missing_key` so FE adoption is measurable.  
**Recommendation for P0 money routes:** **require** key → **400** if missing
after FE ships keys; until FE ready, optional key with no auto-cache (safer than
global auto).

### D3 — Request fingerprint

Continue **SHA-256 of raw request body** as `request_hash`.

- Same key + different body → **409 Conflict** (never silent second side effect).
- Empty body routes still hash empty bytes.
- Do **not** include auth headers in the hash (principal is already in the key).

### D4 — What gets stored / when

| Outcome | Store action |
| --- | --- |
| 2xx | `Complete(key, code, body)` — **only success is replay-safe** |
| 3xx | Treat as non-success → **Release** (should not appear on JSON APIs) |
| 4xx / 5xx | **Release** so client can fix input or retry transient errors |
| Panic / abort mid-flight without Complete | Row stays `response_code=0` until… |

**In-flight stuck claims (PH-011b):** if a process dies after Claim and before
Complete/Release, a later Claim **reclaims** when `response_code=0` and
`created_at` is older than `DefaultIdempotencyStaleAfter` (**2 minutes**):
`DELETE` the pending row then `INSERT` again. Fresh in-flight claims still 409.

Operator “clear stuck key” before the lease expires remains a PH-011e runbook item.

### D5 — Concurrency

Keep **atomic insert claim**:

```sql
INSERT INTO idempotency_keys (key, request_hash) VALUES ($1, $2)
ON CONFLICT (key) DO NOTHING
```

Winner runs handler; loser reads row and branches (replay / conflict / in-flight).

Optional later: unique partial indexes — not required if PK is the scoped key.

### D6 — Fail-open vs fail-closed

**Keep fail-open** when the store errors (current behaviour): if Postgres cannot
serve the idempotency table, the request proceeds. Rationale: the business write
uses the same DB; a total outage already fails the side effect. Partial weirdness
is rare.

**Do not** fail-open on **logical** conflicts (409 cases).

### D7 — Relationship to service-level keys

| Layer | Role |
| --- | --- |
| HTTP middleware | Cheap replay of **HTTP response**; stops double handler entry |
| Service / ledger natural keys | **Truth** if two different HTTP keys still try the same business event |

Examples:

- Admin credit: ledger marker `idem=<key>` remains authoritative even if HTTP layer is bypassed (internal call).
- Loyalty award: `order_id` key remains authoritative for webhook double delivery after HTTP replay window.
- Gift redeem: card status remains authoritative.
- Payment: pending→succeeded transition + (PH-011d) unique `transaction_id`.

**Rule:** HTTP platform is necessary but not sufficient for money; domain
idempotency keys stay.

### D8 — Webhook `transaction_id` vs HTTP key

| Layer | Key |
| --- | --- |
| HTTP | Scoped auto or explicit; dedupes identical POST body |
| DB | **Unique** `payment_transactions.transaction_id` (PH-011d) |
| Service | Confirm only from `pending` |

All three layers are required for production-grade settlement.

### D9 — Metrics (PH-011b, local-first)

Expose counters (Prometheus or existing metrics path — no CI scrape required):

| Metric | Meaning |
| --- | --- |
| `idempotency_claim_total{result=won\|lost\|error}` | Claim outcomes |
| `idempotency_replay_total` | Stored response returned |
| `idempotency_conflict_total{reason=body\|inflight}` | 409s |
| `idempotency_complete_error_total` | Failed to persist success |
| `idempotency_missing_key_total{route=…}` | Optional adoption signal |

### D10 — Retention

- Default **30 days** (`IDEMPOTENCY_KEY_RETENTION=720h`).
- Cron job already deletes expired rows (+ product aggregate ops).
- After retention, a replay may re-execute: acceptable for old keys; FE should
  not reuse a checkout key across sessions longer than retention.

### D11 — Explicit non-goals

- Not a general-purpose distributed lock service.
- Not a substitute for unique business constraints.
- Not applied to all admin CRUD (blog, catalog, etc.) unless a future task asks.
- No multi-currency / multi-warehouse implications.
- No Netflix-style subscription billing tokens here (box subscription create only).

---

## 5. Client contract (FE / BFF / admin)

1. Generate `Idempotency-Key` **once** when the user commits intent (click Place
   order / Redeem / Admin credit).
2. Persist until terminal success UI is shown (sessionStorage / form state).
3. On network retry or double-click, **resend the same key + same body**.
4. On **409 body mismatch**, surface “request conflict — refresh and try again”
   (do not silently change body under same key).
5. On **409 in progress**, brief backoff then retry same key (or show wait).
6. On **2xx replay**, treat as success (same order id / same credit result).

BFF (`apps/frontend` API routes) must **forward** `Idempotency-Key` to the Go
API unchanged. Store (`app/api/store/[...path]`) and admin
(`app/api/admin/[...path]`) copy the incoming header when present via
`pickIdempotencyKeyHeader` and never invent a key. Do not log the value.
The public BFF has no money mutations and does not forward this header.
CORS `Access-Control-Allow-Headers` includes `Idempotency-Key` so a
browser-direct call from an allowed origin can pass preflight (PR-040f).

---

## 6. Implementation roadmap (do not skip order)

| Task | Deliverable |
| --- | --- |
| **PH-011a** | ADR + inventory + dual-doc — **done** |
| **PH-011b** | Scoped keys, stale reclaim, metrics, race tests — **done** |
| **PH-011c** | Wire P0 routes; align admin credit; double-POST tests — **done** |
| **PH-011d** | Unique `transaction_id` + webhook terminal ACK + tests — **done** |
| **PH-011e** | Operator runbook + API docs per route + Obsidian completion — **done** |

---

## 7. Acceptance criteria (for the full PH-011 epic)

- [x] Architecture reader can explain key scope, 409 cases, retention, and layering.
- [x] Every P0 route either requires/uses HTTP keys or has documented natural-key + test.
- [x] Double-POST same key → one side effect under local `go test` (`internal/routes/idempotency_money_test.go`).
- [x] Gateway webhook replay → one Confirm/deduct (+ terminal ACK).
- [x] Dual-doc (project + Obsidian) complete (011e closes the loop).

---

## 8. Related code & docs

| Area | Path |
| --- | --- |
| Middleware | `pkg/middleware/idempotency.go` |
| Migration | `migrations/main/20260614130000_create_idempotency_keys.sql` |
| Cleanup | `internal/corn/idempotency_cleanup_job.go` |
| Webhook route | `internal/features/payments/routes.go` |
| Admin credit | `internal/features/wallet/service.go` |
| Operator runbook | [idempotency-runbook.md](./idempotency-runbook.md) |
| API: orders | [../api/orders.md](../api/orders.md) |
| API: wallet admin credit | [../api/wallet.md](../api/wallet.md) |
| API: gift redeem | [../api/gift-cards.md](../api/gift-cards.md) |
| API: loyalty redeem | [../api/loyalty.md](../api/loyalty.md) |
| API: webhooks | [../api/webhooks.md](../api/webhooks.md) |
| Money sagas | [money-and-stock-sagas.md](./money-and-stock-sagas.md) |
| Payments | [payments-and-webhooks.md](./payments-and-webhooks.md) |
| Dual-track process | `docs/DOCUMENTATION-DUAL-TRACK.md` |
