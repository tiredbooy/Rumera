# FINISHED

## PH-043c — Auto-charge / tokenized pay (decision close)

**Done:** 2026-08-12  
**Verify:** decision + dual-doc only (no charge code — intentionally)

### Decision

**Do not implement** tokenized / automatic box charging in this program.

| Reason | Detail |
|--------|--------|
| No gateway stored credentials | Payments are one-shot txs only |
| No box unit price | Subscribe create is free; contents ops-curated |
| No order+stock from renewal | Fulfilment not automated from `subscriptions` |
| Product fit | Email reminder + pause/skip/cancel is the cellar-box model |

Renewal cron stays: email + advance `next_renewal_at` only.

### Project docs

- `architecture/box-auto-charge-decision.md` (new)
- `architecture/box-subscriptions.md` residual/non-goals updated
- `architecture/README.md` index
- monorepo: FEATURE-ROADMAP, BACKLOG-PRODUCTION-HARDENING, IMPROVEMENT-OPPORTUNITIES, PH-DUAL-DOC-MATRIX
- Code comments: `subscription/doc.go`, `subscription_renewal_job.go`

### Obsidian

- [[ADR Box auto-charge declined]] · Connect 11 · Subscriptions · Known gaps · Journey renewal email · ADR Deferred · Project Brain

### Re-open

Only as a **new** future task when all criteria in the decision doc are met — not residual debt.

### Next

- *(none — lettered PH backlog fully closed)*

---

## PH-060a–d — Modular buy-as-gift (packaging / add-ons)

**Done:** 2026-08-12  
**Founder request:** admin-configurable gift options with optional packaging fees.

### As-built

| Layer | Change |
|-------|--------|
| Settings | `gift` group: enabled flags + `options[]` (id, label, price, …); defaults free `gift_wrap` |
| Orders | `gift_option_ids[]` → server resolve → `gift_addons` snapshot + `gift_addons_fee` in `total_amount` |
| Migration | `20260812180000_order_gift_addons.sql` |
| FE checkout | Multi-select options, summary fee, place order sends ids |
| FE admin | Settings tab «هدیه» (flags + JSON options) |
| Public BFF | `settings` allowlisted for storefront |

Money rule: **never trust client prices** for gift add-ons.

### Project docs

- `docs/api/site-settings.md` — gift group
- `docs/api/orders.md` — gift_option_ids + fee math
- `docs/architecture/gift-checkout-addons.md` — data flow

### Obsidian

- [[Site Settings]] · [[Orders Backend]] · [[Cart and Checkout]] · [[Journey Buy as gift]] · Connect 09

### Residual

- Richer admin option editor (add/remove rows without raw JSON) — optional polish
- Apply migration in each env before go-live

---

## PH-050b — “Read the system in one hour” outline

**Completed:** 2026-08-12 (60s auto-loop)  
**Verify:** docs-only (paths linked from hub + Project Brain)

### Deliverables

- **`docs/READ-THE-SYSTEM.md`** — timed 60 min path: Overview → Architecture → Money sagas → Orders/Payments/Inventory → Loyalty → Search → residuals
- **`docs/README.md`** — founder section + reordered start-here
- **Obsidian `Project Brain`** — “Read the system in one hour” table with vault trails
- Bridges / matrix / backlog / FEATURE-ROADMAP / Known gaps updated

### Program status

**All lettered PH tasks complete** (PH-043c closed as no auto-charge decision).  
Backlog empty for auto-loop purposes.

### Next

- *(none — lettered backlog empty; start a new backlog when needed)*

---

## PH-050a — Dual-doc consistency pass

**Completed:** 2026-08-12 (60s auto-loop)  
**Verify:** file inventory checks (journey MOC/Connect coverage, architecture paths exist) — docs-only

### Deliverables

- **`docs/PH-DUAL-DOC-MATRIX.md`** — every PH phase/task → project docs + Obsidian homes; residuals; non-goals
- **FEATURE-ROADMAP** rewritten: program status, shipped list, deferred, residuals
- **BACKLOG-PRODUCTION-HARDENING** pointer current (next PH-050b)
- **IMPROVEMENT-OPPORTUNITIES** status overlay + strikethroughs for closed audit rows
- **DOCUMENTATION-MAP / dual-track / docs README** inventory updated
- **Obsidian:** Journeys MOC complete (no orphans); Docs Bridge Root/Backend/Frontend/Documentation Bridge; Project Brain start-here; Connect 03 “feature architecture complete”; Known gaps; Referrals + Product Alerts code maps fixed off legacy `internal/services`

### Next

- **PH-050b** — “Read the system in one hour” outline

---

## PH-043b — Box management UX polish

**Completed:** 2026-08-12 (60s auto-loop)  
**Verify:** `go build ./...` + `go test ./internal/features/subscription/ ./internal/corn/` · FE `vitest features/subscriptions` + `tsc --noEmit` — green

### Storefront

- Next ship labelled **ارسال باکس بعدی** + honesty hint (email, no auto-pay)
- Confirm dialogs for **pause / skip / cancel** with effect copy
- Create: physical-box framing, optional address (default preferred), no-charge copy
- Missing-address callout on active cards; `apiErrorToast` on mutations
- Page header: باکس سرداب / physical framing

### Renewal email

- `buildRenewalEmailHTML`: Persian RTL (`lang=fa` `dir=rtl`), reminder + manage CTA, no charge language
- Unit tests in `internal/corn`

### Docs

- FE `subscriptions.md` + account-tour; BE `box-subscriptions.md`; FEATURE-ROADMAP
- Obsidian Journey Manage + renewal email; Known gaps

### Residual

- No PATCH address on existing sub; no contents preference (not modeled)
- ~~PH-043c~~ closed as no auto-charge (see PH-043c finished record)

### Next

- **PH-050a** — Dual-doc consistency pass

---

## PH-043a — Box subscription product model clarity

**Completed:** 2026-08-12 (60s auto-loop)  
**Verify:** `go build ./...` + `go test ./internal/features/subscription/ -count=1` — green

### Product model (locked)

- **Is:** recurring physical **cellar box** (`plan=cellar-box`), monthly/quarterly cadence,
  pause / skip / cancel / resume, optional ship-to address, email renewal reminder
- **Is not:** unlimited catalog access, streaming entitlements, seat SaaS, Netflix auto-bill
- **Contents:** merchant-curated physical assortment — **not** a per-sub SKU list on the wire
- **Renewal job:** email + advance `next_renewal_at` only — **no charge**

### Code (small)

- `PlanCellarBox` constant; `AllowedAction` lifecycle matrix
- Service rejects invalid transitions with `INVALID_REQUEST`
- Unit tests: NextRenewal, AllowedAction, create plan, lifecycle mem-repo

### Docs

- Project: `architecture/box-subscriptions.md`, `api/subscriptions.md`, indexes,
  processes-and-jobs, domain-map, FE `subscriptions.md` + account-tour, FEATURE-ROADMAP
- Obsidian: Subscriptions domain + Backend rewrite; Journey renewal email;
  **Journey Manage cellar box**; Connect 09; Known gaps

### Residual → PH-043b / 043c

- Storefront UX polish (copy, next ship clarity, renewal email RTL content)
- Auto-charge only if gateway tokens + explicit go-ahead (043c)

### Next

- **PH-043b** — Box management UX polish

---

## PH-042b — Buy gift card storefront UX

**Completed:** 2026-08-12 (60s auto-loop)  
**Verify:** `npx vitest run features/gift-cards features/wallet/topup.test.ts` + `npx tsc --noEmit` — green

### Code

- **API:** `purchaseGiftCard` + `listMyGiftCards`; redeem sends `Idempotency-Key`
- **Hooks:** `usePurchaseGiftCard` · `useMyGiftCards` · redeem invalidates mine + wallet
- **UI:** `GiftCardPurchase` (presets/pending), `GiftCardMine` (code + face amount + copy)
- Redeem polish: single-use copy, face-amount honesty, better errors
- Wired on `/account/wallet` next to top-up / redeem

### Docs

- FE `docs/features/gift-cards.md`; wallet + account-tour refresh
- Obsidian Journey Gift card purchase + Loyalty Wallet Gift Cards domain

### Residual

- No email delivery of code (self via mine only)
- No embedded gateway redirect URL (same as top-up)

### Next

- **PH-043a** — Box subscription product model clarity

---

## PH-042a — Buy gift card flow (backend)

**Completed:** 2026-08-12 (60s auto-loop)  
**Verify:** `go build ./...` + `go test ./internal/features/{giftcard,payments}/ ./internal/bootstrap/ ./internal/routes/ -count=1` — green

### Code

- Migration `purchase_txid` (unique partial) on `gift_cards`
- `POST /gift-cards/purchase` → pending `gbuy-*` payment (money idempotency)
- `GET /gift-cards/mine` — purchaser code delivery
- Confirm: `gbuy-*` → `FulfillPaidPurchaseTx` (no wallet credit); `wtop-*` unchanged
- Staff `POST /admin/gift-cards` unchanged
- Tests: fulfill idempotency; Confirm gift vs wallet branch

### Docs

- api/gift-cards.md, architecture/gift-card-purchase.md, idempotency catalogue
- Obsidian Gift Card Backend, Journey Gift card purchase

### Next

- **PH-042b** — Buy gift card storefront UX

---

## PH-041b — Storefront top-up UX

**Completed:** 2026-08-12 (60s auto-loop)  
**Verify:** `npx vitest run features/wallet/topup.test.ts` + `npx tsc --noEmit` — green

### Code

- **API/hooks:** `createWalletTopUp` + `Idempotency-Key`; `useWalletTopUp`
- **`WalletTopUp` UI:** presets, custom amount, bounds, form → pending (copy tx id, refresh balance)
- Replaced «به‌زودی» in wallet overview; wired into `WalletView` beside gift redeem
- Honest copy: no free credit; withdraw not offered

### Docs

- FE `docs/features/wallet.md`; Obsidian journey + Account FE; Known gaps

### Residual

- No embedded gateway redirect URL (API returns `transaction_id` only)

### Next

- **PH-042a** — Buy gift card flow (backend)

---

## PH-041a — Gateway wallet top-up design + API

**Completed:** 2026-08-12 (60s auto-loop)  
**Verify:** `go build ./...` + `go test ./internal/features/{payments,wallet}/ ./internal/bootstrap/ ./internal/routes/ -count=1` — green

### Code

- **`POST /wallet/topup`** — creates pending payment (`order_id` null, `wtop-…` tx id); money idempotency mw
- Amount bounds 10k–50M IRT; currency IRT
- **`payments.Confirm`**: if no order → `wallet.CreditGatewayTopUpTx` in same TX (`topup_txid=` marker)
- Order path unchanged (paid + deduct + loyalty)
- Withdraw remains **410**; no free deposit route
- Unit test Confirm wallet top-up path; money route registration includes topup

### Docs

- `architecture/wallet-topup.md`; api/wallet.md; idempotency catalogue
- Obsidian Wallet Backend, Journey Account wallet top-up, Known gaps

### Residual → PH-041b

- Storefront amount presets + pending/success UX
- Real gateway redirect URL (API returns transaction_id for external pay)

### Next

- **PH-041b** — Storefront top-up UX

---

## PH-040e — Loyalty analytics hooks

**Completed:** 2026-08-12 (60s auto-loop)  
**Verify:** `go test ./pkg/metrics/ ./internal/features/loyalty/ -count=1` + `go build ./...` — green

### Code

- **`pkg/metrics`:** `loyalty_award_total{reason,result}`, `loyalty_redeem_total{result}`
  - Results: award `ok|replay|skip|error`; redeem `ok|replay|insufficient|error`
- **Wired** in loyalty `Award`/`award`, order/signup/review/birthday/clawback/redeem paths
- Scrape test extended

### Docs

- architecture/loyalty.md § Observability — metrics + reserved analytics event schema
  (`loyalty_earned`, `loyalty_redeemed` payload tables)
- observability.md metric table + curl filter
- api/loyalty.md observability section
- Obsidian Loyalty Backend

### Residual

- Analytics DB event insert not wired (queue drop-safe design documented)
- Admin analytics dashboard for programme health later

### Next

- **PH-041a** — Gateway wallet top-up design + API

---

## PH-040d — Admin loyalty rates / tiers UI

**Completed:** 2026-08-12 (60s auto-loop)  
**Verify:** `go build ./...` + `go test ./internal/features/loyalty/ ./internal/routes/ ./internal/bootstrap/` · FE `tsc --noEmit` — green

### Decision

- Keep **env** as source of truth (no DB rates / no free grant UI)
- Ship **read-only** admin snapshot + runbook

### Code

- **BE:** `GET /admin/loyalty/programme` → `ProgrammeResponse` (rates, tiers, `editable:false`)
- Gated `customers:read|write`; wired in `RegisterAdmin`
- **FE:** `/admin/loyalty` page + nav under مشتریان; programme cards + tier table
- Unit test `TestProgrammeReadOnlyEnvSnapshot`

### Docs

- api/loyalty.md + architecture/loyalty.md PH-040d decision
- FE loyalty.md admin section; Obsidian Loyalty Backend/FE, Known gaps

### Residual

- Admin adjust API still deferred
- DB-tunable rates deferred
- PH-040e analytics optional

### Next

- **PH-040e** (optional) or **PH-041a** wallet gateway top-up

---

## PH-040c — Storefront loyalty UX

**Completed:** 2026-08-12 (60s auto-loop)  
**Verify:** `npx vitest run features/loyalty/reasons.test.ts` + `npx tsc --noEmit` — green

### Code

- **`features/loyalty/reasons.ts`** — full Persian ledger reason map + review bonus default copy constant
- **`rewards-view.tsx`** — how-to-earn, lifetime points, honest empty/error, redeem with stable Idempotency-Key
- **Review dialog** — “you earned X” when `verified_purchase`; honest non-verified note
- **`useCreateReview`** — invalidates loyalty account/transactions
- **Order confirmation** — earn-after-paid honesty + link to `/account/rewards`
- **Redeem API** — always sends `Idempotency-Key`

### Docs

- FE `docs/features/loyalty.md`
- Obsidian: Loyalty FE, Account FE, journeys, Known gaps, Connect 04

### Next

- **PH-040d** — Admin loyalty rates / tiers UI (or read-only env view)

---

## PH-040b — Implement earn triggers (backend)

**Completed:** 2026-08-12 (60s auto-loop)  
**Verify:** `go build ./...` + `go test ./internal/features/loyalty/ ./internal/features/reviews/ ./internal/bootstrap/ ./internal/routes/ -count=1` — green

### Code

- **Config:** `LOYALTY_REVIEW_BONUS`, `LOYALTY_BIRTHDAY_BONUS`, `LOYALTY_BIRTHDAY_TZ`, `CRON_LOYALTY_BIRTHDAY_SCHEDULE`
- **Service:** `AwardForReview`, `AwardBirthday`, `RunBirthdayAwards`, `ClawbackOrderEarn`; redeem binds `Idempotency-Key` → `idem:{key}`
- **Repo:** idempotent `Spend` (replay flag), `Clawback`, `GetLedgerDelta`, `ListBirthdayUserIDs` (Feb 29 non-leap handling)
- **Reviews:** best-effort earn after Create when verified purchase
- **Cron:** `loyalty_birthday` job registered when loyalty service present
- **Tests:** review verified-only, birthday keys, clawback no-op, redeem replay without double deposit, reviews→loyalty wire

### Docs

- architecture/loyalty.md status LIVE for review/birthday; API reasons; processes-and-jobs; idempotency catalogue
- Obsidian Loyalty Backend/domain, journeys, Known gaps, Env

### Residual

- Admin adjust API → PH-040d  
- Wire `ClawbackOrderEarn` when refund saga exists  
- Storefront “you earned X” → PH-040c  

### Next

- **PH-040c** — Storefront loyalty UX

---

## PH-040a — Loyalty product rules design (docs-first)

**Completed:** 2026-08-12 (60s auto-loop)  
**Verify:** docs-only (no production code change)

### Project docs

- **`apps/backend/docs/architecture/loyalty.md`** — full Cellar Club rules:  
  live earn (order/signup/referral), planned review/birthday/admin,  
  refund clawback policy, env rates, tiers, anti-abuse, PH-040b checklist  
- **`apps/backend/docs/api/loyalty.md`** — reason catalogue + rates table + design link  
- Index links: architecture README, architecture.md, money sagas, payments-and-webhooks, api README

### Obsidian

- Loyalty Backend + Loyalty Wallet Gift Cards domain refresh  
- Journeys: earn on review, birthday bonus, first purchase points  
- Connect 09, Known gaps, Env and config

### Product decisions locked for PH-040b

- Review earn: **verified purchase only**, once per review id  
- Birthday: **Asia/Tehran**, once per year key `{userID}:{YYYY}`  
- Rates: **env first**; admin UI/DB → PH-040d  
- Clawback: balance only, not lifetime; full refund only in v1  
- No public free grant endpoint  

### Next

- **PH-040b** — Implement earn triggers (backend)

---

## PH-030b — Meilisearch readiness (index quality, not forced cutover)

**Completed:** 2026-08-12 (60s auto-loop)  
**Verify:** `go build ./...` + `go test ./pkg/meili/ ./internal/features/catalog/product/ ./internal/bootstrap/` · FE `tsc --noEmit` — green

### Code

- **`pkg/meili`** — HTTP client: health, ensure index/settings, delete-all, upsert, delete-one, search helper, task wait  
  - httptest unit tests
- **Config:** `MEILI_ENABLED` (default false), `MEILI_INDEX_UID`, `CRON_MEILI_REINDEX_SCHEDULE`
- **Document contract:** `models.MeiliProduct` + brand/category titles + `*_search` via `searchtext.Normalize`
- **`product.ToMeiliProduct`**, `ListForSearchIndex`, `DocumentsFromIndexRows`, `MeiliIndexer.FullReindex` (batched)
- **Cron** `meili_reindex` registered only when client connected at boot
- **Bootstrap:** fail-soft Meili connect (warn + continue); **no** storefront/query cutover

### Docs

- Project: `architecture/search.md` dual-path + failure modes; data-stores; processes-and-jobs (fixed wrong search_job=Meili claim); FE search + MeiliProduct types
- Obsidian: Search Backend, Search domain, ADR ILIKE until Meili, Known gaps, Env config

### Residual (explicit non-goals)

- Incremental upsert on product write
- Hybrid `GET /products?search=` routing
- RequireKey-style cutover flag for storefront

### Next

- **PH-040a** — Loyalty product rules design (docs-first)

---

## PH-030a — ILIKE search quality (Persian-aware baseline)

**Completed:** 2026-08-12 (60s auto-loop)  
**Verify:** `cd apps/backend && go build ./... && go test ./pkg/searchtext/ ./internal/features/catalog/product/ -count=1` — green

### Code

- **`pkg/searchtext`** — `Normalize` / `EscapeLike` / `LikeContains`  
  - Arabic `ك/ي/ى` → Persian `ک/ی`; strip ZWNJ/ZWJ; lower; strip whitespace  
  - LIKE wildcard escape for `ESCAPE E'\\'`
- **Migration** `20260812120000_search_normalize_and_trgm.sql`  
  - `rumera_search_normalize(text)` IMMUTABLE (lockstep with Go)  
  - `pg_trgm` + GIN on normalized product/brand/category **titles**
- **Product filter** (`buildProductFilterSQL`): free-text matches  
  **title OR description OR brand.title OR category.title** via normalize  
  - Empty-after-normalize omits the clause  
- Unit tests: confusables, ZWNJ/space, escape, multi-field SQL, empty skip

### Docs

- Project: `architecture/search.md` rewrite; `data-stores.md` Meili honesty; BE README; architecture.md pointer; FE `features/search.md`; IMPROVEMENT 6.7 closed
- Obsidian: Search Backend, Search domain, ADR Search ILIKE until Meili, Journey Search to PDP, Search FE, Known gaps

### Residual → PH-030b

- Meili index quality / dual-path design; no forced cutover
- Other admin list `search=` endpoints still simple ILIKE (not storefront discovery)

### Next

- **PH-030b** — Meilisearch readiness (index quality, not forced cutover)

---

## PH-012a — Shared models vs feature-local types audit

**Completed:** 2026-08-12  
**Verify:** `go build ./...` green

### Code / docs

- `internal/models/doc.go` — package ownership rules
- `internal/models/tax.go` — `TaxRate` moved out of errors.go (clarity only)
- `docs/conventions.md` — § Models ownership + Error mapping path + decision tree
- `architecture/domain-map.md` — expanded models table
- Stale code maps fixed: inventory.md, payments-and-webhooks.md → feature packages
- Obsidian: Wire contracts, Backend package map, Layered Backend

### Residual

- Catalogue wire DTOs remain in `models` (product/variant/media cycle avoidance) — intentional

---

## PH-012b — Error mapping consistency

**Completed:** 2026-08-12  
**Verify:** `go test ./internal/platform/httpx/ ./internal/features/{orders,payments,wallet,rbac,cart,auth}/ -count=1` green

### Code

- Feature handlers: all `response.HandleError` → `httpx.HandleError` (orders, payments, inventory, cart, coupons, shipping, tag, auth, webhook)
- `httpx` domain map: + hierarchy cycle, access denied, product has history
- `httpx/errors_test.go` — sentinel + wrapped + apperr mapping
- Repos: `err == pgx.ErrNoRows` → `errors.Is` (rbac, analytics stats)

### Docs

- conventions error path; Obsidian Error model

---

## PH-013a — Fire-and-forget goroutine safety

**Completed:** 2026-08-12 (60s auto-loop)  
**Verify:** `cd apps/backend && go build ./... && go test ./pkg/async/ ./internal/features/auth/ ./internal/features/blog/ ./internal/features/recipes/ ./internal/features/orders/ ./internal/middlewares/ ./internal/bootstrap/ -count=1` — green

### Code

- **`pkg/async`** — `Go` / `GoCtx` with panic recover + stack log; `SetLogger` at bootstrap
- Wired production detached work:
  - `auth/otp.go` — OTP SMS (`auth.otp_sms`, 10s)
  - `auth/password_reset_service.go` — reset email (`auth.password_reset_email`, 15s)
  - `orders/handler.go` — confirm email (`orders.confirm_email`, 15s)
  - `blog/handler.go` — record read (bounded slots + `blog.record_read`)
  - `recipes/handler.go` — record view (`recipes.record_view`, 5s)
  - `middlewares/analytics.go` — event capture (`analytics.capture`)
- Tests: panic recover, run, nil fn, context timeout

### Docs

- Project: `architecture/processes-and-jobs.md` § Detached request-path work
- Obsidian: Processes and Jobs, Pitfalls, Known gaps

### Residual

- Long-lived process goroutines (HTTP ListenAndServe, analytics workers, cron) intentionally not wrapped — different lifecycle
- Full worker-pool drain on shutdown is optional later (not required for panic safety)

---

## PH-012c — Backend: clear, stable error contracts for humans

**Completed:** 2026-08-12 (60s auto-loop)  
**Verify:** `cd apps/backend && go build ./... && go test ./pkg/response/ ./internal/platform/httpx/ ./internal/features/{giftcard,loyalty,wallet,auth,orders,payments}/ -count=1` — green

### Code

- **`pkg/response/codes.go`**
  - **Bugfix:** `INSUFFICIENT_FUNDS` no longer maps to `PAYMENT_FAILED`
  - Expanded registry: coupon family, shipping, funds/points, gift card, account disabled, invalid state
  - `FromAppError`: prefer AppError message; unknown typed codes keep Code+Message (no silent INTERNAL collapse)
  - Actionable default messages (stock, cart, coupons)
- **`pkg/apperr`:** `ErrInsufficientPoints`, `ErrGiftCardInvalid`, `ErrAccountDisabled`; clearer stock/cart/coupon copy
- **`httpx`:** map hero schedule/CTA sentinels; use shared `response.Err*` for money sentinels
- **Gift redeem:** `ErrGiftCardInvalid` (not generic NOT_FOUND)
- **Loyalty redeem:** `ErrInsufficientPoints` (not wallet funds)
- **Auth login/OTP/refresh:** disabled/banned → `ACCOUNT_DISABLED`
- **Tests:** `codes_test.go`, expanded `httpx/errors_test.go` (status+code+message; no leak; no PAYMENT_FAILED for funds), giftcard redeem contract

### Docs

- Project: `architecture/error-messages.md` catalogue; conventions § User-clear errors; architecture README index
- Obsidian: Error model rewrite; Pitfalls; Known gaps

### Residual → PH-012d

- Frontend still often toasts generic Persian; must surface `code`/`message`/`fields`

---

## PH-012d — Frontend: show real API errors (no generic-only UX)

**Completed:** 2026-08-12 (60s auto-loop)  
**Verify:** `cd apps/frontend && npx vitest run lib/api/user-facing-error.test.ts features/cart/errors.test.ts` + `npx tsc --noEmit` — green

### Code

- **`lib/api/user-facing-error.ts`** — `describeApiError` / `apiErrorToast` / `apiErrorMessage`  
  - Code → Persian map (stock, coupon family, funds/points, gift, session, RBAC, …)  
  - Generic fallback only without API shape or empty/generic message  
  - Duck-types `ApiError`, `ApiClientError`, feature error classes
- **`ApiClientError`** — optional `fields` from envelope
- **Wired:** checkout place-order + coupon validate, cart mutations, gift redeem,  
  loyalty redeem, admin wallet credit, admin account actions, recipe bulk-add
- **Tests:** mapper unit tests + cart OUT_OF_STOCK specific copy

### Docs

- FE: `docs/platform/api-layer.md` § User-facing errors; `storefront-commerce.md`
- Obsidian: Error model FE section

### Residual

- NextAuth credentials login still collapses all failures to one Persian line (no code passthrough)
- Many non-money admin toasts still use local `e.message` / static strings — follow-up optional

### Next

- **PH-013b** — Business metrics + saga spans (local-first)

---

## PH-013b — Business metrics + saga spans (local-first)

**Completed:** 2026-08-12 (60s auto-loop)  
**Verify:** `cd apps/backend && go build ./... && go test ./pkg/metrics/ ./pkg/tracing/ ./internal/features/{orders,payments,inventory,wallet}/ -count=1` — green

### Code

- **`pkg/metrics`:** `orders_created_total`, `orders_create_duration_seconds`,  
  `payments_settled_total`, `payments_confirm_duration_seconds`,  
  `inventory_ops_total{op,result}`, `wallet_ops_total{direction,result}` + scrape test
- **`pkg/tracing.Start`:** no-op-safe saga spans with error status
- **Wired:** CreateOrder, Confirm/Fail, Reserve/Deduct/Release, AdminCredit/Deposit/Withdraw/Purchase  
  (idempotency hit already counted since PH-011)

### Docs

- Project: `observability.md` metric table + local curl + span table
- Obsidian: Observability money/stock section

### Residual

- Full Jaeger compose still optional (doc already shows how); no new deploy workflow
- Loyalty earn/redeem counters deferred to PH-040

### Next

- **PH-013c** — Test balance on critical pure paths (local)

---

## PH-013c — Test balance on critical pure paths (local)

**Completed:** 2026-08-12 (60s auto-loop)  
**Verify:** `cd apps/backend && go build ./... && go test ./pkg/token/ ./internal/middlewares/ ./pkg/middleware/ ./internal/features/payments/ -count=1` — green

### Code / tests

- **JWT (`pkg/token/jwt_test.go`):** expired, wrong secret, empty/garbage, refresh missing JTI, Generate pair round-trip
- **RequirePermission residual:** empty role, checker error → 500, empty permission strings deny staff
- **Webhook fail→release:** `StockReleaser` interface on payments handler; test asserts ReleaseForOrder once with lines; terminal replay does not double-release
- **Idempotency store:** already thorough (PH-011b) — re-run in scoped suite (no new cases required)

### Docs

- `docs/TESTING.md` § Critical pure paths (commands + table)
- Obsidian Testing — PH-013c command block

### Residual

- Still no CI (charter)
- Integration money paths remain tag-gated

### Next

- **PH-020a** — Inventory list wire: product weight / missing-weight

---

## PH-020a — Inventory list wire: product weight / missing-weight

**Completed:** 2026-08-12 (60s auto-loop)  
**Verify:** `cd apps/backend && go build ./... && go test ./internal/features/inventory/ -count=1` · FE `tsc --noEmit` — green

### Code

- SQL projection joins `products.weight` (list, low-stock, by-variant via shared projection)
- Domain `Inventory.WeightKg`; response `weight` (omitempty) + **`missing_weight`** (always bool; true if null/≤0)
- Mapper + JSON contract tests
- FE `InventoryItem` contract + test fixtures

### Docs

- Project: `api/inventory.md` weight section; FE `docs/features/inventory.md`
- Obsidian: Inventory domain, Inventory Backend, Journey Admin restock, Known gaps

### Residual → PH-020b

- Admin UI badge/filter for `missing_weight` (085a)

---

## PH-020b — Task 085a FE: missing-weight remediation signal

**Completed:** 2026-08-12 (60s auto-loop)  
**Verify:** `cd apps/frontend && npx vitest run features/admin/inventory/components/InventoryTable.test.tsx` + `tsc --noEmit` — green

### Code

- **InventoryTable:** weight column — «وزن ناقص» amber badge when `missing_weight`; filter «وزن بسته‌بندی»
- **List page:** KPI «وزن ناقص» + description hint
- **Variant detail:** callout + «ویرایش وزن محصول» link; weight metric
- Test: missing_weight row surfaces badge title

### Docs / cross-link

- FE `docs/features/inventory.md`; Obsidian Inventory domain + Admin restock journey
- **Refactor-Docs Task 085a** marked done with cross-link to this workstream

### Next

- **PH-020c** — Checkout shipping weight sum (storefront truth)

---

## PH-020c — Checkout shipping weight sum (storefront truth)

**Completed:** 2026-08-12 (60s auto-loop)  
**Verify:** FE `vitest package-weight` + `tsc` · BE `go test ./internal/features/{cart,orders,shipping}/` — green

### As-built + code

- **BE already:** cart SQL projects `weight_kg`; CreateOrder sums `WeightKg × qty` and authorizes shipping by address country region
- **FE:** `CartItem.weight_kg` on contract; `packageWeightKg` util + unit tests; checkout uses typed sum → `useShippingMethods(region, weight, subtotal)` (no cast)
- Region remains address country only

### Docs

- `api/cart.md` weight_kg; `api/shipping.md` available params + PH-020c note
- FE storefront-commerce; Obsidian Cart and Checkout + Journey First purchase; Known gaps

### Residual

- Lines without weight quote as 0 kg until staff fills product weight (PH-020b signal)

### Next

- **PH-021a** — RBAC completeness audit vs admin surfaces

---

## PH-021a — RBAC completeness audit vs admin surfaces

**Completed:** 2026-08-12 (60s auto-loop)  
**Verify:** `go build ./... && go test ./internal/routes/ ./internal/middlewares/ ./internal/features/rbac/ ./internal/features/inventory/ ./internal/features/orders/ -count=1` — green

### Audit finding

`RequirePermission` is **OR** of listed grants. Mounting read+write together let
staff with only `*:read` hit **write** routes. All surfaces were already gated,
but write privilege was too loose.

### Code

- Split RegisterAdmin read/write (and product delete) for:  
  inventory, orders, reviews, blog, recipes, products, users  
- Write groups: `inventory:write`, `orders:write|refund`, `reviews:moderate`,  
  `journal:write`, `recipes:write`, `products:write` / delete, `customers:write|ban`  
- Category/brand/option/variant/media writes: write caps only (no read OR)

### Docs

- New `apps/backend/docs/architecture/rbac.md` matrix + operator playbook  
- FE `docs/platform/rbac.md` staff + RequirePermission refresh  
- Obsidian RBAC; architecture README index

### Residual → PH-021b

- Last-admin lockout UX; mid-session revoke expectations/tests

### Next

- **PH-021b** — Staff/capability UX polish + tests (local)

---

## PH-021b — Staff/capability UX polish + tests (local)

**Completed:** 2026-08-12 (60s auto-loop)  
**Verify:** `go test ./internal/features/users/ -count=1` + FE `tsc --noEmit` — green

### Code

- **Last-admin lockout:** demote/deactivate sole active `admin` → `ErrConflict` (409) under row lock + count
- Pure helpers + unit tests: `wouldRemoveActiveAdmin`, `isLastActiveAdmin`
- FE: UserEditForm / UserAccountActions Persian copy for CONFLICT + ACCESS_DENIED
- Capability matrix: mid-session revoke expectations in copy; admin empty-matrix note

### Docs

- `architecture/rbac.md` edge-case table + playbook; FE rbac.md; Obsidian RBAC

### Next

- **PH-030a** — ILIKE search quality (Persian-aware baseline)

---

## PH-000a — Dual-doc map & “how to document a change” playbook

**Completed:** 2026-08-11  
**Verify:** docs-only (no code compile required)

### Delivered

**Project docs**

- Created `docs/DOCUMENTATION-DUAL-TRACK.md` — two tracks, sync rules, ADR when, change-type matrix, agent workflow, DoD
- Linked from `docs/DOCUMENTATION-MAP.md`, `docs/README.md`

**Obsidian brain**

- `12 Playbooks/Playbook Document a change.md` (money/auth/inventory hard rule)
- `00 Meta/Vault conventions.md` — dual-track section
- `07 Docs Bridge/Documentation Bridge.md` + `Docs Bridge Root.md`
- `Brain/Project Brain.md` start table + `Brain/Connect 12 Playbooks.md` list

### Residual

- Agents must still follow the playbook on later code tasks

---

## PH-000b — Architecture deep-dive pack (as-built)

**Completed:** 2026-08-11  
**Verify:** docs-only

### Project docs

- `apps/backend/docs/architecture.md` — Phase 2 complete banner, trust tiers, design principles, where-to-look
- `apps/backend/docs/architecture/domain-map.md` — as-built Phase 2, RBAC note fixed
- `apps/backend/docs/architecture/README.md` — index refresh + dual-track + money sagas pointer
- `apps/backend/docs/how-it-works.md` — §0 feature/department + engineer links
- `docs/SYSTEM-OVERVIEW.md` — backend shape + dual-track

### Obsidian

- `02 Architecture/Layered Backend.md` — rewrite (no legacy)
- `10 Code Maps/Backend package map.md` — full features tree
- `11 Decisions/ADR Backend feature packages.md` — migration complete
- `02 Architecture/Pitfalls and anti-patterns.md` — free money, fake tx, cycles, dual-doc, deferred

### Acceptance

Reader can answer: who owns a domain, how routes/trust tiers work, DI location, stock/money entry points.

---

## PH-000c — Money & stock saga narrative

**Completed:** 2026-08-11  
**Verify:** docs-only

### Project docs

- Created `apps/backend/docs/architecture/money-and-stock-sagas.md` (mermaid sagas A–F, invariants, lock order, deferred)

### Obsidian

- `02 Architecture/Money and stock rules.md` — linked sagas + no free money + lock sort

---

## PH-000d — Future-deferred decisions

**Completed:** 2026-08-11  
**Verify:** docs-only

### Project docs

- `docs/FEATURE-ROADMAP.md` — explicit deferred table + ADR pointer

### Obsidian

- `11 Decisions/ADR Deferred product and platform.md`
- `Brain/Connect 11 Decisions.md` list updated
- Known gaps already listed multi-currency/warehouse/crypto/CI (prior PH-000 prep)

---

## PH-011e — Idempotency runbook + dual-doc completion

**Completed:** 2026-08-11 (main session — continuous loop, no 5m idle gap)  
**Verify:** docs-only

### Project

- `apps/backend/docs/architecture/idempotency-runbook.md` (FE keys, SQL inspect, stale reclaim, retention, metrics, webhook, admin credit)
- Status flip on `idempotency.md` (PH-011 complete)
- architecture README index
- API: `orders.md`, `webhooks.md`, `wallet.md` (admin credit), new `gift-cards.md`, `loyalty.md`, api README

### Obsidian

- `Playbook Idempotency debug` + Connect 12

### Residual

- FE must actually send keys (measurable via `idempotency_missing_key_total`)
- Optional RequireKey=true after FE ships

---

## PH-010a — Blog/recipe service real atomicity

**Completed:** 2026-08-11  
**Verify:** `cd apps/backend && go build ./... && go test ./internal/features/blog/ ./internal/features/recipes/ -count=1` — green

### Code

- **Blog:** already production-correct (`WithTx` + `blogDB` + service uses `txRepo`; rollback tests exist).
- **Recipes:** added `recipeDB` + `Repository.WithTx`; Create/Update use `txRepo` for parent + ingredients + products + tags.
- New tests: `internal/features/recipes/service_tx_test.go` (relation failure rolls back; success commits).

### Docs

- Obsidian: Recipes Backend, Blog Backend, Pitfalls

---

## PH-011a — Idempotency design ADR + inventory of money routes

**Completed:** 2026-08-11  
**Verify:** docs-only (exploration of middleware, migrations, feature routes; no production code change)

### Project docs

- Created `apps/backend/docs/architecture/idempotency.md` — as-built inventory, full money-route catalogue (P0–Out), ADR decisions D1–D11 (header, **scoped keys**, body hash, 2xx-only store, stale reclaim need, fail-open, layered domain keys, `transaction_id` UNIQUE plan, metrics, retention, FE contract, roadmap 011b–e)
- Linked from `architecture/README.md`, `architecture.md`, `payments-and-webhooks.md`, `money-and-stock-sagas.md` (Saga F)

### Obsidian

- `11 Decisions/ADR Idempotency platform.md`
- `09 Journeys/Journey Idempotent retry checkout webhook.md` (order double-submit, webhook, admin credit, gift redeem)
- Connect 11 / Connect 09 lists; Money and stock rules; Known gaps (011a done, 011b–e open); Docs Bridge Backend; First purchase + Payment webhook journeys

### Key findings for implementers

1. HTTP middleware wired **only** to `POST /webhooks/payment`.
2. Store key is currently **global raw header** — PH-011b must scope by principal+route.
3. `payment_transactions.transaction_id` has non-unique index only → PH-011d UNIQUE.
4. Admin wallet credit already service-level idempotent; align with platform in 011c.
5. P0 to wire: orders, gift-card redeem, loyalty redeem, admin credit (align), webhook (keep).

### Residual

- Code: PH-011b → 011e (do not skip order)

---

## PH-011b — Shared store + middleware hardening

**Completed:** 2026-08-11  
**Verify:** `cd apps/backend && go build ./... && go test ./pkg/middleware/ ./pkg/metrics/ -count=1` — green

### Code

- **`pkg/middleware/idempotency.go`**
  - Scoped durable keys: `{tier}:{principal}:{METHOD}:{route}:{clientKey}`
  - `IdempotencyWithConfig` (`AllowAutoKey`, `RequireKey`) for PH-011c money mounts
  - Client key validation (8–128, no whitespace/`|`)
  - Stale reclaim on pending rows older than **2m** (`DefaultIdempotencyStaleAfter`)
  - Metrics hooks on claim/replay/conflict/complete-error/missing-key
- **`pkg/metrics/metrics.go`** — `idempotency_*` counters
- **Tests** — body conflict, in-flight 409, concurrent single winner, different principals same client key, stale reclaim, require/optional key, invalid key

### Docs

- Project: `architecture/idempotency.md` (as-built PH-011b), `observability.md` metrics table
- Obsidian: ADR Idempotency platform, Journey Idempotent retry, Known gaps

### Residual

- **PH-011c** wire P0 routes (orders, redeem, loyalty redeem, admin credit align)
- **PH-011d** UNIQUE `payment_transactions.transaction_id`
- **PH-011e** runbook + per-route API docs

---

## PH-011c — Apply to money routes

**Completed:** 2026-08-11  
**Verify:** `cd apps/backend && go build ./... && go test ./pkg/middleware/ ./internal/routes/ ./internal/features/orders/ ./internal/features/giftcard/ ./internal/features/loyalty/ ./internal/features/wallet/ ./internal/features/payments/ -count=1` — green

### Code

- **`internal/bootstrap/newRouter.go`** — one store; `webhookIdem` (auto-key) + `moneyIdem` (`AllowAutoKey=false`, `RequireKey=false`)
- **`internal/routes/routes.go`** — `Setup(..., webhookIdem, moneyIdem)`; money mw threaded to customer/admin registers
- **Feature mounts (P0):**
  - `payments.RegisterPublic` → webhook (existing)
  - `orders.RegisterCustomer` → `POST /orders` + moneyIdem
  - `giftcard.RegisterCustomer` → `POST /gift-cards/redeem` + moneyIdem
  - `loyalty.RegisterCustomer` → `POST /loyalty/redeem` + moneyIdem
  - `wallet.RegisterAdmin` → `POST /admin/users/:userID/wallet/credit` + moneyIdem (service-level ledger key retained)
- **`internal/routes/idempotency_money_test.go`** — double-POST one side effect on all P0 paths; missing-key no-cache; Register* path wiring

### Docs

- Project: `architecture/idempotency.md` as-built 011c + bootstrap wiring; `observability.md` note
- Obsidian: ADR Idempotency platform, Journey Idempotent retry (A–E), Known gaps

### Residual

- **PH-011d** UNIQUE `payment_transactions.transaction_id`
- **PH-011e** runbook + per-route API docs + RequireKey flip when FE ready
- Loyalty redeem domain event key (PH-040 patterns)
- FE/BFF must send `Idempotency-Key` for replay safety (optional today)

---

## PH-011d — Payment gateway transaction uniqueness

**Completed:** 2026-08-11  
**Verify:** `cd apps/backend && go build ./... && go test ./internal/features/payments/ ./pkg/middleware/ ./internal/routes/ -count=1` — green  
(Integration tests under `//go:build integration` need `TEST_DATABASE_URL`.)

### Code / migration

- **`migrations/main/20260811180000_payment_transaction_id_unique.sql`**
  - Dedupe rows by `transaction_id` (prefer succeeded → refunded → pending → failed; highest id)
  - Drop non-unique `idx_payment_transactions_txid`
  - `CREATE UNIQUE INDEX CONCURRENTLY uq_payment_transactions_transaction_id`
- **`payments/pgerr.go`** — `isUniqueViolation` (23505)
- **`payments/repository.go`** — Create maps unique → `models.ErrConflict`
- **`payments/service.go`** — Create maps conflict → `apperr.ErrConflict`
- **`payments/webhook.go`** — `ackIfTerminal`: already-settled Confirm/Fail → **200** `{received, replayed:true}`
- **Tests:** webhook HTTP replay ACK (success + fail), create unique conflict, terminal status helpers; integration unique insert + domain replay count

### Docs

- Project: `architecture/idempotency.md` §2.3, catalogue row #1, roadmap; `payments-and-webhooks.md` three-layer idempotency
- Obsidian: ADR Idempotency platform, Journey webhook settle + idempotent retry, Payments Backend, Known gaps

### Residual

- Apply migration on any live DB before relying on UNIQUE
- Loyalty redeem domain event key (PH-040)
- FE `RequireKey` flip when storefront always sends keys

---

## PH-011e — Idempotency runbook + dual-doc completion

**Completed:** 2026-08-11  
**Verify:** docs-only (platform already verified under PH-011b–d tests)

### Project docs

- **`apps/backend/docs/architecture/idempotency-runbook.md`** — FE key rules, SQL inspect, stuck reclaim, retention cron, metrics, webhook/admin layers, escalate matrix
- **`apps/backend/docs/architecture/idempotency.md`** — status PH-011 complete; acceptance checked; API/runbook links
- **API (P0 money routes):**
  - `api/orders.md` — Idempotency-Key on place order
  - `api/webhooks.md` — auto-key + terminal `replayed` ACK
  - `api/wallet.md` — no free deposit; withdraw 410; **admin credit** two-layer idempotency
  - `api/gift-cards.md` — **new** redeem + admin issue
  - `api/loyalty.md` — **new** account/tx/redeem + HTTP key residual note
  - `api/README.md` — resource + route map updates
- **Ops:** `operations.md` cleanup job; `processes-and-jobs.md` retention pointer; architecture README index

### Obsidian

- `12 Playbooks/Playbook Debug Idempotency.md` (+ MOC / Connect 12 / Debug Webhook cross-link)
- ADR Idempotency platform → complete; Journey Idempotent retry + Account wallet redeem
- Backend: Orders, Wallet, Gift Card, Loyalty, Payments
- Domains: Payments, Loyalty Wallet Gift Cards, Orders
- Known gaps, Money and stock rules, Docs Bridge Backend, Pitfalls

### Residual (not blocking 011e)

- FE always send keys → later flip `RequireKey=true` on money mounts
- Loyalty redeem **domain** spend event key (PH-040)
- Apply UNIQUE migration on live DBs if not yet applied

### Next

- **PH-012a** — shared models vs feature-local types audit

---

## PH-012a — Shared `models` vs feature-local types audit

**Completed:** 2026-08-12 (60s auto-loop resume)  
**Verify:** `cd apps/backend && go build ./... && go test ./internal/models/ ./internal/platform/httpx/ -count=1` — green  
(docs + package-doc discipline; no production type relocation)

### Audit findings

| Area | As-built |
|------|----------|
| Domain entities (order, payment tx, inventory, wallet, cart, …) | Already feature-local under `internal/features/<name>/model.go` |
| `internal/models` | Small shared package only (errors, filter/pagination, NullablePatch, PaymentMethod, catalogue wire DTOs, TaxRate) |
| Catalogue product list/detail wire | Intentionally shared — product/variant/media cycle avoidance |
| Hero-only sentinels in `errors.go` | Residual optional move; not worth churn this task |
| Stale architecture code maps | **Fixed** inventory.md + payments-and-webhooks.md still cited deleted `internal/models/*.go` / legacy services paths |

### Project docs

- `internal/models/doc.go` — package ownership rules (already present; confirmed)
- `docs/conventions.md` — Models ownership + decision tree + intentional shared table + residuals
- `architecture/domain-map.md` — PH-012a policy + as-built check
- `architecture/inventory.md` — code map → `features/inventory/*`
- `architecture/payments-and-webhooks.md` — related code → `features/payments/*` + shared PaymentMethod
- `architecture/README.md` — index row for models ownership

### Obsidian

- `Wire contracts.md` — decision tree
- `Backend package map.md` — `internal/models` inventory section
- `Layered Backend.md` — shared models note
- `Known gaps.md` — PH-012a complete; next PH-012b

### Code moves

**None.** No type was clearly wrong enough to relocate without cycle risk or multi-file churn. Policy documented instead.

### Residual → PH-012b

- `httpx.HandleError` mapping completeness for residual sentinels (`ErrAccessDenied`, `ErrHierarchyCycle`, `ErrProductHasHistory`, hero CTAs, …)
- Prefer single error path; `errors.Is` discipline on money handlers

### Next

- **PH-012b** — Error mapping consistency (`handleError` / sentinels)

---
