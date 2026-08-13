# AUTO_LOOP_LOG

## 2026-08-12 — PH-050b done (read-the-system outline) · PROGRAM COMPLETE

- **Claimed/finished:** PH-050b — `docs/READ-THE-SYSTEM.md` + Project Brain one-hour tour
- **Verify:** docs-only dual-doc
- **Next claim:** none — lettered backlog empty (PH-043c closed 2026-08-12)

## 2026-08-12 — PH-043c done (auto-charge declined)

- **Claimed/finished:** PH-043c — decision close, no tokenized charge code
- **Docs:** `box-auto-charge-decision.md` + dual-track ADR/roadmap/matrix
- **Next claim:** none
- **IN_PROGRESS:** idle · **AUTO_LOOP:** COMPLETE (stop scheduler)

## 2026-08-12 — PH-050a done (dual-doc consistency)

- **Claimed/finished:** PH-050a — PH-DUAL-DOC-MATRIX, roadmap/improvements cleanup, bridges + Journeys MOC
- **Verify:** journey link scan + architecture path inventory OK (docs-only)
- **Next claim:** PH-050b (read-the-system outline)
- **IN_PROGRESS:** idle

## 2026-08-12 — PH-043b done (box management UX polish)

- **Claimed/finished:** PH-043b — next-ship labels, pause/skip/cancel confirms, address on create, RTL due email
- **BE:** `subscription_renewal_email.go` + tests; corn + subscription tests green
- **FE:** helpers/view/card/create/dialog polish; vitest + tsc green
- **Docs:** FE subscriptions + box-subscriptions + Obsidian journeys
- **Next claim:** PH-050a (dual-doc consistency pass)
- **IN_PROGRESS:** idle

## 2026-08-12 — PH-043a done (box subscription product model)

- **Claimed/finished:** PH-043a — cellar-box product model clarity (docs + lifecycle guards)
- **Code:** `PlanCellarBox`, `AllowedAction`, service transition guards, unit tests
- **Docs:** `architecture/box-subscriptions.md`, `api/subscriptions.md`, FE subscriptions/account-tour; FEATURE-ROADMAP
- **Obsidian:** Subscriptions domain rewrite, Backend, Journey renewal + Manage cellar box; Known gaps
- **Verify:** `go build ./...` + `go test ./internal/features/subscription/` green
- **Next claim:** PH-043b (box management UX polish)
- **IN_PROGRESS:** idle

## 2026-08-12 — PH-042b done (gift card storefront)

- **Claimed/finished:** PH-042b — purchase form, mine list, redeem polish on wallet
- **Verify:** vitest gift-cards + tsc green
- **Next claim:** PH-043a (box subscription product model clarity)
- **IN_PROGRESS:** idle

## 2026-08-11 — loop start

- **Status:** **ACTIVE** (resumed 2026-08-12)  
- **Scheduler:** `019ff481c40d` @ **60s**  
- **Completed:** through **PH-012b**  
- **Next claim:** **PH-013a** (goroutine safety)  
- **Handoff file:** `RESUME-TOMORROW.md` (stale pause notes; prefer TASKS/FINISHED)

### Interval change

- Scheduler `019ff0f47733` updated from **20m → 5m** (same task id, phase kept).

### Why it looked “stale” (2026-08-11)

- Scheduler fires are **interval ticks**, not continuous workers. After a fire finishes
  a task, the agent **exits** and nothing runs until the next interval.
- UI “waiting for next attention” = completed subagent, not stuck mid-task.
- `IN_PROGRESS` was correctly **Idle** with next claim PH-011c — no mid-flight work.
- Recreated scheduler with **5m + fire_immediately** so work resumes without waiting a full tick.

### Fire 1 (manual start)

- Phase 0 dual-doc + architecture pack + money sagas + deferred ADR shipped  
- PH-010a: recipes real WithTx atomicity + tests; blog already fixed  
- `go build ./...` + blog/recipes tests green  
- Scheduler created: every 20m continues from PH-011a  

### Fire 2 (scheduler 019ff0f47733)

- **PH-011a done** (docs-first):  
  - `apps/backend/docs/architecture/idempotency.md` (ADR + full money-route inventory)  
  - Obsidian ADR + Journey Idempotent retry checkout/webhook  
  - Cross-links architecture README, payments, money sagas, Known gaps  
- **Next:** PH-011b (scoped keys, stale reclaim, metrics, race tests)  

### Fire 3 (scheduler 019ff0f47733)

- **PH-011b done** (code + dual-doc):  
  - Scoped store keys; `IdempotencyWithConfig`; 2m stale reclaim  
  - Prometheus `idempotency_*` counters  
  - Unit tests: conflict, inflight, race, principal isolation, stale reclaim  
  - `go build ./...` + `go test ./pkg/middleware/ ./pkg/metrics/` green  
- **Next:** PH-011c wire P0 money routes + double-POST tests  

### Fire 4 (scheduler / production-hardening auto-loop)

- **PH-011c done** (code + dual-doc):  
  - `newRouter`: webhookIdem + moneyIdem (AllowAutoKey=false, RequireKey=false)  
  - Wired: `POST /orders`, gift-card redeem, loyalty redeem, admin wallet credit (+ webhook kept)  
  - Admin credit: HTTP platform + existing service-level `idem=` ledger key  
  - Tests: double-POST one side effect; missing-key pass-through; Register* paths  
  - `go build ./...` + scoped `go test` green  
- **Next:** PH-011d UNIQUE `payment_transactions.transaction_id`  

### Fire 5 (scheduler / production-hardening auto-loop)

- **PH-011d done** (migration + code + dual-doc):  
  - Migration `20260811180000_payment_transaction_id_unique.sql` (dedupe + UNIQUE CONCURRENTLY)  
  - Create maps 23505 → conflict; webhook terminal ACK 200 `replayed`  
  - Unit tests: webhook replay success/fail, unique conflict; integration tests added  
  - `go build ./...` + scoped unit tests green  
- **Next:** PH-011e idempotency runbook + API docs + Obsidian completion  

### Fire 6 (scheduler / production-hardening auto-loop · 60s)

- **PH-011e done** (docs dual-track; no code change this fire):  
  - Operator runbook: inspect keys, stale reclaim, retention cron, FE header contract  
  - API docs for all P0 money routes (orders, webhooks, wallet admin credit, gift-cards, loyalty)  
  - Obsidian playbook + Payments/Wallet/Orders/Gift/Loyalty domain+backend notes  
  - Known gaps + ADR marked PH-011 complete  
- **IN_PROGRESS:** Idle → next **PH-012a**  
- **Note:** prior platform tests remain the verify baseline (`go test` under 011b–d); this fire docs-only  

### Fire 6 (main session — user: loop too slow)

- Cancelled 5m scheduler; new **60s + fire_immediately** `019ff135f08f`  
- **PH-011e done** in main session (runbook + API + Obsidian) so no wait  
- **PH-011 epic complete** → next PH-012a  

### Pause EOD (user: pause for today, resume tomorrow)

- Scheduler `019ff135f08f` **cancelled**  
- `IN_PROGRESS` cleared (PH-012a had been claimed mid-flight — **not finished**)  
- Wrote `RESUME-TOMORROW.md` for next session  
- AUTO_LOOP status → **PAUSED**  

### Fire 7 (2026-08-12 — 60s auto-loop resume)

- **Finished mid-claim PH-012a** (models vs feature-local audit):  
  - Confirmed domain types already feature-local; `internal/models` shared-only  
  - conventions decision tree + intentional shared table; domain-map as-built check  
  - Fixed stale code maps: inventory.md, payments-and-webhooks.md (legacy services/models paths)  
  - Obsidian: Wire contracts, Backend package map, Layered Backend, Known gaps  
  - **No** big-bang type moves (catalogue wire / PaymentMethod stay for cycle avoidance)  
  - `go build ./...` + `go test ./internal/models/ ./internal/platform/httpx/` green  
- **Next:** PH-012b error mapping consistency  
- `IN_PROGRESS` → idle, next claim PH-012b  

### Resume 2026-08-12 (user: continue loop, quality code)

- New scheduler `019ff481c40d` @ 60s  
- **PH-012a** models ownership (doc.go, tax.go, conventions, dual-doc)  
- **PH-012b** httpx.HandleError everywhere in features; errors.Is pgx; mapping tests  
- `go build ./...` + scoped tests green  
- **Next:** PH-013a  

### Fire 8 (2026-08-12 — 60s auto-loop)

- **PH-012a dual-doc polish** (decision tree, stale inventory/payments code maps, package map)  
- **PH-013a done** (fire-and-forget safety):  
  - `pkg/async` Go/GoCtx + recover + SetLogger in bootstrap  
  - Wired: OTP SMS, password-reset email, order confirm email, blog read, recipe view, analytics capture  
  - Tests: panic recover, timeout, nil fn  
  - Dual-doc: processes-and-jobs, Pitfalls, Processes and Jobs vault  
  - `go build ./...` + scoped tests green  
- **Next (user priority):** PH-012c clear backend error contracts → PH-012d FE surfaces  
  (then PH-013b metrics/spans)  
- `IN_PROGRESS` → idle, next claim PH-012c

### Task backlog update (user: clear user-facing errors)

- Added **PH-012c** (backend clear error contracts) + **PH-012d** (FE show real API errors)  
- Claim order: after current mid-flight 013a → **012c → 012d** → rest of 013 → …  
- Goal: no generic-only “something went wrong” when domain knows the reason  

### Fire 9 (2026-08-12 — 60s auto-loop)

- **PH-012c done** (backend user-clear errors):  
  - Fixed `INSUFFICIENT_FUNDS` → was wrongly `PAYMENT_FAILED`  
  - Registry + FromAppError (prefer message; no unknown-code collapse to INTERNAL)  
  - Gift `GIFT_CARD_INVALID`, loyalty `INSUFFICIENT_POINTS`, auth `ACCOUNT_DISABLED`  
  - Actionable stock/cart/coupon messages; hero sentinels in httpx  
  - Docs: `architecture/error-messages.md` + conventions + Obsidian Error model  
  - Tests: response/httpx/giftcard + scoped money packages green  
- **Next:** PH-012d FE show real API errors  
- `IN_PROGRESS` → idle, next claim PH-012d  

### Fire 10 (2026-08-12 — 60s auto-loop)

- **PH-012d done** (FE user-facing API errors):  
  - `lib/api/user-facing-error.ts` code→Persian + safe server message rules  
  - Wired: checkout, cart, gift redeem, loyalty redeem, admin wallet credit, account actions, recipe bulk-add  
  - `ApiClientError.fields`; tests + tsc green  
  - Dual-doc: api-layer + storefront-commerce + Obsidian Error model  
- **Next:** PH-013b business metrics + saga spans  
- `IN_PROGRESS` → idle, next claim PH-013b  

### Fire 11 (2026-08-12 — 60s auto-loop)

- **PH-013b done** (business metrics + saga spans):  
  - Metrics: orders_created, payments_settled, inventory_ops, wallet_ops + histograms  
  - `tracing.Start` spans on CreateOrder, Confirm/Fail, inventory lifecycle, wallet ops  
  - scrape test + dual-doc observability  
  - `go build` + scoped tests green  
- **Next:** PH-013c test balance  
- `IN_PROGRESS` → idle, next claim PH-013c  

### Fire 12 (2026-08-12 — 60s auto-loop)

- **PH-013c done** (critical pure-path test balance):  
  - JWT: expired/wrong secret/empty/missing jti + pair round-trip  
  - RequirePermission: checker error 500, empty role, empty perm strings  
  - Webhook fail→ReleaseForOrder once; StockReleaser interface; no double-release on replay  
  - Documented in docs/TESTING.md + Obsidian Testing  
  - `go build` + scoped tests green; no CI  
- **Next:** PH-020a inventory weight wire  
- `IN_PROGRESS` → idle, next claim PH-020a  

### Fire 13 (2026-08-12 — 60s auto-loop)

- **PH-020a done** (inventory weight wire):  
  - SQL `products.weight` on inventory projection; `weight` + `missing_weight` on response  
  - FE InventoryItem types; mapper tests; dual-doc API + domain/journey  
  - `go test ./internal/features/inventory/` + FE tsc green  
- **Next:** PH-020b FE missing-weight signal (085a)  
- `IN_PROGRESS` → idle, next claim PH-020b  

### Fire 14 (2026-08-12 — 60s auto-loop)

- **PH-020b done** (085a FE missing-weight signal):  
  - Table badge + filter; list KPI; variant callout → product edit  
  - Refactor-Docs 085a closed (cross-link)  
  - vitest InventoryTable + tsc green  
- **Next:** PH-020c checkout shipping weight sum  
- `IN_PROGRESS` → idle, next claim PH-020c  

### Fire 15 (2026-08-12 — 60s auto-loop)

- **PH-020c done** (checkout package weight):  
  - FE CartItem.weight_kg + packageWeightKg util/tests; checkout quote uses real sum + address region  
  - BE already authoritative at CreateOrder; dual-doc cart/shipping/checkout  
  - vitest + tsc + scoped go test green  
- **Next:** PH-021a RBAC audit  
- `IN_PROGRESS` → idle, next claim PH-021a  

### Fire 16 (2026-08-12 — 60s auto-loop)

- **PH-021a done** (RBAC completeness):  
  - Fixed write-over-privilege (read-only staff could hit write routes via OR lists)  
  - Split read/write RegisterAdmin for inventory/orders/reviews/blog/recipes/products/users  
  - Category/brand/variant/option/media write-only caps  
  - Docs: architecture/rbac.md matrix + playbook; FE rbac.md; Obsidian RBAC  
  - go build + routes/middleware/rbac tests green  
- **Next:** PH-021b staff UX polish  
- `IN_PROGRESS` → idle, next claim PH-021b  

### Fire 17 (2026-08-12 — 60s auto-loop)

- **PH-021b done** (staff/capability polish):  
  - Last-admin demote/deactivate → 409 CONFLICT under lock  
  - Unit tests for last-admin helpers; FE Persian conflict messages  
  - Matrix mid-session revoke copy; rbac playbook edge-case table  
  - go test users + tsc green  
- **Next:** PH-030a Persian-aware search  
- `IN_PROGRESS` → idle, next claim PH-030a  

### Fire 18 (2026-08-12 — 60s auto-loop)

- **PH-030a done** (Persian-aware ILIKE baseline):  
  - `pkg/searchtext` Normalize/EscapeLike/LikeContains (ك/ي→ک/ی, ZWNJ, strip spaces)  
  - SQL `rumera_search_normalize` + pg_trgm GIN on product/brand/category titles  
  - Product free-text: title|description|brand|category via normalize  
  - Dual-doc: architecture/search.md, data-stores, FE search, Obsidian Search* + ADR  
  - go build ./... + searchtext + product tests green  
- **Next:** PH-030b Meili readiness  
- `IN_PROGRESS` → idle, next claim PH-030b  

### Fire 19 (2026-08-12 — 60s auto-loop)

- **PH-030b done** (Meili readiness, no cutover):  
  - `pkg/meili` client + settings + full rebuild + httptest tests  
  - MeiliProduct + *_search normalize; ListForSearchIndex; MeiliIndexer batches  
  - MEILI_ENABLED default false; fail-soft boot; cron meili_reindex when connected  
  - Dual-path design + failure modes in search.md; processes-and-jobs fix  
  - go build + scoped tests + FE tsc green  
- **Next:** PH-040a loyalty rules design  
- `IN_PROGRESS` → idle, next claim PH-040a  

### Fire 20 (2026-08-12 — 60s auto-loop)

- **PH-040a done** (loyalty product rules design, docs-first):  
  - architecture/loyalty.md: earn catalogue, clawback, tiers, env rates, anti-abuse, 040b checklist  
  - api/loyalty.md reason catalogue; cross-links money sagas / payments  
  - Obsidian Loyalty Backend/domain + journeys (review, birthday, first purchase)  
  - Docs-only verify  
- **Next:** PH-040b implement earn triggers  
- `IN_PROGRESS` → idle, next claim PH-040b  

### Fire 21 (2026-08-12 — 60s auto-loop)

- **PH-040b done** (loyalty earn triggers backend):  
  - Review verified-purchase award; birthday cron + TZ; redeem idem: key  
  - ClawbackOrderEarn helper; Spend replay-safe  
  - go build + loyalty/reviews/bootstrap/routes tests green  
  - Dual-doc architecture/api/obsidian  
- **Next:** PH-040c storefront loyalty UX  
- `IN_PROGRESS` → idle, next claim PH-040c  

### Fire 22 (2026-08-12 — 60s auto-loop)

- **PH-040c done** (storefront loyalty UX):  
  - Rewards how-to-earn + full reason FA + error honesty + redeem Idempotency-Key  
  - Review verified toast “you earned X”; order confirm paid-only honesty  
  - FE docs/loyalty.md + Obsidian Loyalty FE; vitest + tsc green  
- **Next:** PH-040d admin loyalty rates  
- `IN_PROGRESS` → idle, next claim PH-040d  

### Fire 23 (2026-08-12 — 60s auto-loop)

- **PH-040d done** (admin loyalty rates read-only):  
  - GET /admin/loyalty/programme env snapshot; FE /admin/loyalty + nav  
  - Decision: env-only, no DB edit / no free grant  
  - go tests + tsc green; dual-doc  
- **Next:** PH-040e optional or PH-041a  
- `IN_PROGRESS` → idle, next claim PH-040e  

### Fire 24 (2026-08-12 — 60s auto-loop)

- **PH-040e done** (loyalty analytics hooks):  
  - Prometheus loyalty_award_total + loyalty_redeem_total wired in service  
  - Documented loyalty_earned / loyalty_redeemed analytics payload schema  
  - metrics + loyalty tests green  
- **Next:** PH-041a gateway wallet top-up  
- `IN_PROGRESS` → idle, next claim PH-041a  

### Fire 25 (2026-08-12 — 60s auto-loop)

- **PH-041a done** (gateway wallet top-up API):  
  - POST /wallet/topup → pending payment; Confirm credits wallet when order_id null  
  - topup_txid marker; withdraw 410; dual-doc wallet-topup.md  
  - payments/wallet/routes tests green  
- **Next:** PH-041b storefront top-up UX  
- `IN_PROGRESS` → idle, next claim PH-041b  

### Fire 26 (2026-08-12 — 60s auto-loop)

- **PH-041b done** (storefront top-up UX):  
  - WalletTopUp presets/custom/pending; Idempotency-Key; refresh balance  
  - Replaced coming-soon; FE wallet.md + dual-doc  
  - vitest + tsc green  
- **Next:** PH-042a gift card purchase BE  
- `IN_PROGRESS` → idle, next claim PH-042a  

### Fire 27 (2026-08-12 — 60s auto-loop)

- **PH-042a done** (gift card purchase BE):  
  - POST /gift-cards/purchase (gbuy-*), GET /gift-cards/mine  
  - Confirm fulfills card via purchase_txid; staff issue remains  
  - migration + dual-doc; tests green  
- **Next:** PH-042b storefront buy UX  
- `IN_PROGRESS` → idle, next claim PH-042b
