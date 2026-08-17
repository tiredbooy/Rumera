# Rumera — Improvement Opportunities (re-audit)

> **Dated 2026-06-20.** This document **supersedes** the prior sweep (the previous version of this file and `apps/backend/BACKEND-IMPROVEMENTS.md` — git keeps the history). It is the consolidated output of an **11-agent re-audit run AFTER commit `1e2eb43`** (which implemented 16 planned changes: admin categories/brands/recipe-builder/hero-slides/edit-user, site-settings API, blog enhancements, PDP reviews+recommendations+wishlist, `cmd/seed` seeder, auth token-refresh). Many prior items are now genuinely **resolved** — see the first section. Everything below was re-verified against current source.
>
> Audit dimensions: BE security/money, BE perf/DB, BE quality/API, BE testing, FE UX, FE a11y/RTL/SEO, FE perf, FE quality/types, FE↔BE contract drift, DevOps/CI/observability, product/feature gaps.
>
> **⚑ = cross-corroborated** by 2+ independent auditors → highest confidence. Effort: **S** ≤ half-day · **M** ~1–3 days · **L** multi-day.

---

## Status overlay — production-hardening program (PH-050a · 2026-08-12)

The ordered program in
[`BACKLOG-PRODUCTION-HARDENING.md`](./BACKLOG-PRODUCTION-HARDENING.md) closed
many audit rows. **Do not re-implement** these without a new bug report:

| Audit item (approx.) | Program task | Status |
|----------------------|--------------|--------|
| 1.3 blog/recipe fake txs | PH-010a | **Closed** |
| 5.6 non-unique payment `transaction_id` | PH-011d | **Closed** (UNIQUE + terminal ACK) |
| Idempotency on money routes | PH-011* | **Closed** (platform + mounts) |
| 5.11 fire-and-forget panics | PH-013a | **Closed** (`pkg/async`) |
| 5.12 business metrics / saga spans | PH-013b | **Code done**; compose scrape residual |
| 5.21 JWT/RBAC residual tests | PH-013c | **Closed** (local pure-path tests) |
| 5.1 checkout weight=0 | PH-020c | **Closed** (package weight sum) |
| Inventory weight wire / missing-weight | PH-020a–b | **Closed** |
| 6.7 title-only ILIKE | PH-030a | **Closed**; Meili readiness PH-030b (no cutover) |
| User-clear errors | PH-012c–d | **Closed** |
| Wallet free deposit / withdraw | PH-041 | Free deposit gone; withdraw **410** |
| Gift card customer purchase | PH-042 | **Closed** (staff issue remains) |
| Box subscription (not Netflix) | PH-043a–c | **Closed**; auto-charge declined (decision) |

Still open examples from this file: **6.8** list LIMIT, personalization edge
weights (**5.19**), admin polish residual, DevOps scrape/healthcheck (**5.12/5.13**),
CI (**out of program scope**). Dual-doc map: [`PH-DUAL-DOC-MATRIX.md`](./PH-DUAL-DOC-MATRIX.md).

---

## ✅ Resolved since the last sweep

Solid, verified progress. Grouped by area.

**Money & data integrity (BE)** — the prior P0/P1 money flags are genuinely closed:
- Free-money `POST /wallet/deposit` route + handler **removed** (not re-added by `1e2eb43`); wallet credit is now internal-only.
- Order↔stock atomicity: order Create + items + coupon record + `inventory.ReserveForOrderTx` run in **one tx** (`order_svc.go:119-164`) — oversell window closed.
- Payment↔stock atomicity: `paymentRepo.Confirm` + `MarkAsPaid` + `DeductForOrderTx` in one tx, deduct error now fails the tx (`payment_svc.go:127-185`); webhook no longer double-deducts.
- Coupon usage-limit TOCTOU fixed via `LockByID` (`SELECT … FOR UPDATE`) re-check **inside** the order tx (`order_svc.go:247-273`).
- Insecure-default config guards at startup: production rejects short JWT secret, CORS `*`, empty webhook key, `SMS_PROVIDER=log` (`configs/config.go:234-280`).
- Login rate-limit now **fails closed** to an in-memory limiter when Redis is absent (`middlewares/ratelimit.go`); trusted-proxies wired (`bootstrap/newRouter.go:25-31`).
- CORS hardening (no credentialed wildcard), JWT alg-confusion rejection + single-use refresh rotation, admin self-lockout guard, `models.Err*`→4xx mapping (for the migrated category/brand/recipe/hero/site_settings handlers) — all verified clean.

**Performance & DB (BE)** — money-integrity indexes added (`20260616130000_money_integrity_indexes.sql`), `order_items.product_variant_id` migrated (the runtime checkout bug), perf indexes for product images + `orders(user_id,created_at)`, blog list paginated+indexed, reviews list paginated (no N+1). Read-through caching now exists for product detail, category tree, recipe, and site settings.

**Testing (BE)** — integration harness exists (`tests/integration/`, gated by `TEST_DATABASE_URL`) with real proof tests for order/payment atomicity, coupon race under concurrency, and login fail-closed; config + webhook-HMAC tests added.

**Storefront (FE)** — the prior "headline" gap is largely closed: ⚑ **recommendations** (trending/similar/FBT/for-you) surfaced on PDP + home; ⚑ **reviews displayed** on PDP (summary, list, JSON-LD, write dialog); ⚑ **wishlist wired to real API** with optimistic updates; recently-viewed rail; view+wishlist interaction recording; all customer route groups (subscriptions/loyalty/alerts/addresses/gift-cards/referrals/coupons/wallet) wired to real endpoints. Account dashboard, checkout, and most Epic-B UX polish landed.

**a11y/RTL/SEO (FE)** — `<main>` landmark, mobile-menu `aria-expanded`, gallery alt text, `buildMetadata` (canonical/OG/noindex), `robots.ts` for admin/account/auth, strong JSON-LD on PDP/category/recipe/journal.

**Admin (FE)** — categories/brands/recipe-builder/hero-slides/edit-user/settings + **customers** screen migrated to the real admin API with full loading/empty/error states and AlertDialog confirms.

**DevOps** — backend `.dockerignore` added, prod Dockerfile keeps `GOSUMDB` on, trusted-proxies wired, OTel + Prometheus + Grafana **infra authored**, deep `/health/ready` probe added.

### ⏩ Fixed in the immediate follow-up "next slice" batch
The recommended first slice (below) shipped right after this sweep:
- **1.1** product price-filter SQL — rewritten to correlated `EXISTS` subqueries (was invalid aggregate-in-`WHERE` against an unjoined alias → 500).
- **1.2** store BFF `me` allow-list — `/me/taste-profile` now proxies; personalization surface unblocked.
- **3.1** `order_items` indexes — `idx_order_items_order_id` / `idx_order_items_product_id` added `CONCURRENTLY` (`20260620140000`).
- **5.2** review-image IDOR — ownership check in `AddImage` + `validate:"required,max=2048"` on `ImageURL`.
- **5.3** `h.handleError` migration — `address`/`inventory`/`referral`/`review` handlers no longer 500 on `models.Err*`.
- **4.1** CI pipeline — `.github/workflows/ci.yml` runs build/vet/golangci-lint/`go test -race`/integration (Postgres service) + FE lint/tsc/build.

---

## 🔴 Highest priority

### Epic 1 — Broken / no-op core paths (correctness)

**1.1 ⚑ Product list price filter builds invalid SQL → 500 on every `?min_price`/`?max_price`** · *BE perf/DB* · **CRITICAL**
- **Evidence:** `product_repo.go:215-221` appends `MIN(pv.price) >= @min_price` / `MAX(pv.price) <= @max_price` to the **WHERE** clause, but `FROM products p` only — no `JOIN product_variants pv`, no `GROUP BY` (`:241-250`). FE wires it (`lib/catalog/products.ts:35-36`, `models/product.go:91-92`). *Verified directly: the WHERE uses the aggregate and the alias `pv` is undefined.*
- **Problem:** Aggregates are illegal in `WHERE` and `pv` doesn't exist; any storefront catalogue request with a price facet returns a Postgres error → 500. The price filter is completely non-functional (repo comment falsely claims it "joins variants for min/max price").
- **Fix:** Filter via `EXISTS (SELECT 1 FROM product_variants pv WHERE pv.product_id=p.id AND pv.price BETWEEN …)`, or `LEFT JOIN … GROUP BY p.id HAVING MIN/MAX`. Add a repo test. · **S**

**1.2 ⚑ Taste-profile is unreachable — store BFF allow-list omits the `me` segment** · *contract-drift / FE quality* · **CRITICAL**
- **Evidence:** `app/api/store/[...path]/route.ts` `ALLOW` set has no `"me"` (*verified directly*); `lib/api/hooks.ts:282,291` call `storeRequest("me/taste-profile")`; backend route exists (`routes.go:166-167`). Handler returns 403 `FORBIDDEN_PATH` when `!ALLOW.has(segments[0])`.
- **Problem:** Every taste-profile read/write 403s before reaching the backend. The taste quiz can never load or save, the account taste card is permanently empty, and `ForYouRail` reads `taste.data?.categories` (always undefined) so users are stuck on the "take the quiz" CTA forever — the entire personalization surface is silently dead.
- **Fix:** Add `"me"` to the `ALLOW` set (`/me/*` is already Auth-guarded backend-side). Add a test asserting every first-segment used by the hooks is allow-listed. · **S**

~~**1.3 ⚑ blog & recipe service "transactions" are no-ops**~~ — **done PH-010a** (real WithTx atomicity in feature packages).

### Epic 2 — Admin console is half-mock (operators act on fabricated data)

**2.1 ⚑ Orders / inventory / reviews / analytics admin screens render `lib/admin/data.ts` mock data** · *FE quality + contract-drift + feature-gaps* · **HIGH** (corroborated by 3 auditors)
- **Evidence:** At audit time, `app/admin/orders/page.tsx` → `orders-table.tsx:4` (`adminOrders`); `app/admin/inventory/page.tsx:7` + `inventory-table.tsx:8`; `reviews-queue.tsx:9`; `app/admin/analytics/page.tsx:6` + `analytics-view.tsx:13` (`revenueSeries`/`topProducts`) used mock data while real backend endpoints existed. The required migration pattern is resource-owned APIs under `features/`.
- **Problem:** Operators see fabricated revenue, orders, stock, and an entirely fictional analytics board; decisions are made on invented numbers. The `1e2eb43` admin redesign was only half-migrated.
- **Fix:** Add resource-owned API functions and server-prefetch real data (orders/inventory first — operational; analytics second). Delete the mock exports and retire shared admin hooks as each owner takes over. · **L**

**2.2 ⚑ Admin order/customer/inventory/product actions fire fake `"(نمونه)"` success toasts** · *FE UX* · **HIGH**
- **Evidence:** `order-actions.tsx:49,58,90` (refund/status "(نمونه)"), `customer-actions.tsx:55,79` (block/unblock), `inventory-table.tsx:53` (set-stock), `products-table.tsx:123,188` (duplicate/delete).
- **Problem:** Destructive actions (refund, block customer, set stock, delete) report green success while persisting nothing — actively misleading; worse than no feedback. Settings-view does this honestly with a "به‌زودی" disabled badge.
- **Fix:** Wire to the live admin API (2.1), or until then disable with a "به‌زودی" badge. Never report success for a no-op. · **L** (folds into 2.1)

### Epic 3 — Missing indexes & uncached hot reads (scaling cliffs)

**3.1 `order_items` has NO index on `order_id` or `product_id`** · *BE perf/DB* · **HIGH**
- **Evidence:** `20260526174540_create_order_items.sql` defines only the table (FKs don't create indexes); only `product_variant_id` is indexed (`20260616131000`). Hot consumers: `order_repo.go:283` GetItems, the entire recommendation engine (`recommendation_repo.go:251-261` FBT self-join, `:101-103` purchased, `:186-190` trending, `:417-444` ComputeProfile).
- **Problem:** Order detail, every PDP "frequently bought together" rail, the home trending rail, and the nightly profile recompute all sequential-scan one of the fastest-growing tables; FBT degrades super-linearly.
- **Fix:** One `CONCURRENTLY` migration: `idx_order_items_order_id`, `idx_order_items_product_id` (consider covering `(product_id, order_id)` for FBT). · **S**

**3.2 Recommendation engine runs heavy full-catalogue scans on every storefront hit with zero caching** · *BE perf/DB* · **HIGH**
- **Evidence:** `recommendation_repo.go:171-340` each strategy scans `FROM products p` with two LATERAL subqueries/row plus CTE aggregations; `internal/handlers/recommendation.go` uses **no** `h.cachedJSON` (product/recipe/category/site-settings all do).
- **Problem:** PDP + home render multiple rails, each firing the most expensive read in the app, recomputed live per request, despite results changing slowly. It's the only hot read path with no read-through cache.
- **Fix:** Wrap Trending (5–10 min, keyed by window/category) and Similar/FBT (10–30 min, keyed by product id) in `h.cachedJSON` — infra already exists. · **M**

### Epic 4 — CI / reliability gate is entirely absent

**4.1 ⚑ No CI/CD pipeline exists — nothing gates merges** · *BE testing + DevOps* · **HIGH** (corroborated)
- **Evidence:** No `.github/` (or GitLab/Jenkins/Drone) anywhere (verified by find). `apps/backend/.golangci.yml:11` falsely claims "CI runs it"; Makefile targets are never auto-invoked.
- **Problem:** The money/auth integration tests added in `1e2eb43` (payment confirm, coupon race, login limiter) only run if a human remembers `make test`. The whole reliability investment is unenforced; the hardened P0 paths can silently regress. Hand-written mocks (`internal/mocks/mocks.go`) can drift from interfaces (caught only by `go build`, also ungated).
- **Fix:** Add `.github/workflows/ci.yml`: backend job (`golangci-lint`, `go build`, `go test -race ./...`, `postgres:17` service + `make test-integration`); frontend job (`npm ci`, `lint`, `tsc --noEmit`, `next build`). Path-filter per app. · **M**

**4.2 No `-race` coverage; security-critical pure logic untested** · *BE testing* · **HIGH**
- **Evidence:** `grep -race` over Makefile/CI = nothing; concurrency tests run without the race detector. `pkg/token` and `pkg/crypto` show `[no test files]` — the JWT alg-confusion guard (`jwt.go:86-135`) and the failed-payment→release path (`webhook.go:84`, error discarded) are untested.
- **Problem:** A data race in the saga/limiter code or a regression in the alg-confusion keyfunc / `failed`-callback stock-release would ship undetected — the failure branch is exactly where Epic-E inventory drift could reappear.
- **Fix:** `go test -race` in CI; add small no-DB tests for `pkg/token` (alg:none/RS256/wrong-secret/expired/missing-jti rejected), `RequireRole` middleware, and an httptest webhook handler test covering the `failed`→`ReleaseForOrder` path (and stop discarding that error). · **S–M**

---

## 🟡 Medium

~~**5.1 ⚑ Checkout shipping weight=0**~~ — **done PH-020c** (packageWeightKg + cart weight contract; region from address).

**5.2 IDOR: any user can attach arbitrary image URLs to ANY review** · *BE security* · the lone new security hole (top-of-medium)
`review.go:164-180` AddReviewImage never calls `h.uid(c)`; `review_svc.go:206-229` AddImage only does an existence check (unlike Update/Delete which pass userID); `ReviewImageReq.ImageURL` (`models/review.go:99-104`) has no validation tag. A logged-in user can POST images onto any review by iterating numeric ids, and the unvalidated URL renders on the public PDP (stored-content/URL-injection). Pass the caller's userID, verify ownership, add `validate:"required,url,max=2048"`. · **S**

**5.3 ⚑ address & inventory handlers still return 500 for not-found/conflict** · *BE security + BE quality* · corroborated
`address.go` and `inventory.go` (and review/referral handlers) call raw `response.HandleError`, which only understands `*apperr.AppError`; wrapped `models.Err*` falls through to 500. The `1e2eb43` `h.handleError` migration covered category/brand/recipe/hero/site_settings but missed these. Also `blog_category`/`review_image`/`search_summary` repos return untyped string not-found errors (no `%w` sentinel), so even `h.handleError` can't rescue them. Swap to `h.handleError` and return `models.ErrNotFound` from those repos; add a startup test asserting every `models.Err*` maps. · **S**

**5.4 Admin stock `Adjust` no-ops on a missing inventory row yet records a phantom movement** · *BE security/data-integrity*
`inventory_repo.go:151-174` UPDATEs with no `RowsAffected()` check then unconditionally inserts an `inventory_movements` row; service commits regardless; handler returns 204. Wrong/un-seeded variant id → orphan movement + false success; negative adjust below 0 hits the CHECK constraint as a raw 500. Check `RowsAffected()==0 → ErrNotFound`, guard the negative case, route through `h.handleError`. · **S**

**5.5 Unordered stock-reservation loop → deadlock risk between concurrent orders** · *BE perf/DB*
`order_svc.go:152-156` reserves in cart order; two checkouts with the same variants in opposite order acquire row locks in conflicting order → Postgres 40P01 mid-checkout. Sort the reservation slice by `VariantID` (and in Release/Deduct) for consistent global lock ordering. · **S**

~~**5.6 payment `transaction_id` non-unique**~~ — **done PH-011d** (UNIQUE index + terminal webhook ACK).

**5.7 Three account hooks call backend endpoints that don't exist** · *contract-drift + FE quality*
`account-hooks.ts:151` bare `recommendations`, `:190` `reviews/mine`, `:200` `reviews/pending` (all tagged `TODO(api): confirm`) → `NoRoute` 404. "My Reviews", "Reviews to write", and the account recommendation widget always error/empty. Add the routes or repoint at existing ones; also fix the `RecommendedProduct.id` vs backend `product_id` shape drift by adopting the already-correct `RecommendationItem` type. · **M**

~~**5.8 Server analytics middleware writes an empty `Payload` → all search-analytics reports are empty**~~ — **done PR-070d**. `GET /products?search=` is `search_performed` with `query` + `results_count`. There is no `GET /search`. List errors do not invent zero hits.

**5.9 Site-settings admin update is read-modify-write with no row lock** · *BE security*
`site_settings_svc.go:39-52` Get→merge-in-Go→Update with no `FOR UPDATE`/version check; two concurrent admin saves clobber each other. Lock the singleton row or add optimistic-concurrency. · **S**

**5.10 Cart mutations have no optimistic update, no remove toast/undo** · *FE UX*
`hooks.ts:38-91` use only `onSuccess`; `cart-lines.tsx:22` a single shared `busy` flag dims **all** lines on any tap; remove (`:90`) shows no toast and no undo (prior Epic-B ask). The wishlist hooks already implement the gold-standard `onMutate`+rollback. Copy that pattern, scope disabled state per-item, add remove toast with undo. · **M**

~~**5.11 Fire-and-forget goroutines outside Recovery**~~ — **done PH-013a** (`pkg/async.Go` / `GoCtx`).

**5.12 Observability scrape / compose still residual** · *DevOps* — **PH-013b** shipped app business metrics + saga spans. Residual: Prometheus/Grafana **scrape profile** in compose (no CI/server program). · **M**

**5.13 Prod backend has no compose healthcheck; frontend waits on `service_started`** · *DevOps*
`docker-compose.prod.yml` backend has no `healthcheck`; frontend `depends_on: { condition: service_started }`, so it comes up before the backend can reach Postgres/Redis/Meili → 5xx flapping every deploy. The new deep `/health/ready` probe is wired into zero healthchecks. Add a `/health/ready` healthcheck + `service_healthy`. · **S**

~~**5.14 nginx prod edge: no security headers, `server_tokens` on, no rate limit**~~ — **done PR-090l** (`server_tokens off`, nosniff / SAMEORIGIN / Referrer-Policy on the edge including `/api/v1`+`/media`, prod `limit_req` on `/api/v1/auth/` + `/api/public/auth/`). Residual: TLS 443 block still commented (no HSTS on HTTP). · **M**

~~**5.15 `@sentry/nextjs` declared but completely unwired**~~ — **done PR-090d** (removed unused SDK; no `SENTRY_DSN` in env).

**5.16 Account overview fires 6 client queries on mount with no server prefetch** · *FE perf*
`account-overview.tsx:64-70` calls 6 hooks post-hydration; zero `HydrationBoundary`/`dehydrate` in the repo. The page is already a server component — prefetch + `HydrationBoundary` (PDP reviews are the template). · **M**

**5.17 `components/ui/table.tsx` is `"use client"`; recharts not code-split** · *FE perf*
The table primitive is purely presentational yet forces the whole admin subtree to client-render — delete line 1. recharts is eagerly bundled (`grep next/dynamic` = 0 hits repo-wide); wrap chart components in `next/dynamic`. Admin-only blast radius. · **S / M**

~~**5.18 `images.remotePatterns` allows `hostname:"**"`**~~ — **done PR-090c**.
Allow-list is `NEXT_PUBLIC_MEDIA_BASE_URL` / `NEXT_PUBLIC_API_URL` hostnames
(empty when same-origin `/media`).

**5.19 Personalization starved: `purchase`(10) and `add_to_cart`(4) signals never recorded** · *feature-gaps*
FE records only `view` + `wishlist`; the engine ranks by a score dominated by the two highest-weight edges that the UI never creates. Fire `add_to_cart` in `add-to-cart-button.tsx` onSuccess and `purchase` on order-confirmation. Cheap, directly powers the now-live rails. · **S**

**5.20 Multiple `<h1>` on the home page (one per off-screen hero slide)** · *FE a11y/SEO*
`hero-carousel.tsx:164` renders an `<h1>` per slide; embla keeps all slides in the DOM. Render the active slide's title as `<h1>`, others as `<h2>`/`aria-hidden`. · **M**

**5.21 RBAC `RequireRole` and refresh-token rotation are untested** · *BE testing*
`auth.go:70-84` (the only admin gate) and `auth_tokens.go` single-use rotation have no tests; the cache-absent path silently disables rotation (replay window). Add `auth_test.go` + a fake-cache `consumeRefresh` test. · **S–M**

---

## 🟢 Low / polish

- **6.1 Product-card wishlist heart missing** · *feature-gaps* — wishlist CRUD only reachable from the PDP panel (`catalog/product-card.tsx` has no heart). Biggest place wishlisting drives return visits. Add a heart using `useHasWishlistItem`/`useAdd/Remove`. · **M**
- **6.2 ⚑ Dead npm deps** · *FE perf + FE quality* — axios, qs, uploadthing, lodash-es, zustand, nanoid, @tanstack/react-virtual, react-day-picker, vaul, cmdk, react-resizable-panels (+ dead shadcn primitives) all have zero importers; posthog-js installed-not-initialized (`@sentry/nextjs` removed in PR-090d). Remove after a final grep. · **M**
- ~~**6.3 `/wallet/withdraw` free-ish debit**~~ — **done PH-041a** (withdraw **410**; gateway top-up is the fund path).
- **6.4 `isBusinessError` uses `==` not `errors.Is`** (`inventory_svc.go:217-225`); **`search_summary_repo` compares `pgx.ErrNoRows` with `==`** — latent landmines on the money path; switch to `errors.Is`. · **S**
- **6.5 ⚑ Inconsistent error path** — 122 `response.HandleError` vs 70 `h.handleError` call-sites, mixed within single files. Make `h.handleError` the only sanctioned path + a grep-based CI ban. · **M**
- **6.6 Order-confirmation email is English, hardcoded HTML, IRR as `%.2f`** on a Persian/RTL Toman store (`order.go:60-65`). Replace with a Persian RTL template + Toman formatting + order lines. · **M**
- ~~**6.7 Product search is title-only ILIKE**~~ — **done PH-030a** (Persian normalize + multi-field + pg_trgm). **PH-030b** Meili readiness done; **storefront cutover** still deferred.
- **6.8 Per-user lists unbounded** — `subscription_repo`/`alert_repo` `ListByUser` have no LIMIT. Add `LIMIT 100`. · **S**
- **6.9 Admin user list: no index on `role`/`created_at`, `SELECT *` + positional 18-col Scan** (`user_repo.go:156-247`) — column-order fragile + full scan on the new customers page. Add indexes, explicit column list. · **S**
- **6.10 DB pool sizing hardcoded** (`db.go:28-29` maxConns 25); surface `DB_MAX_CONNS`/`DB_MIN_CONNS`. · **S**
- ~~**6.11 ⚑ Storefront home "featured" rail + its JSON-LD render 8 hardcoded mock bottles**~~ — **catalog live**; **JSON-LD done PR-080k**. Home mounts Organization + WebSite from `siteConfig` (`HomeStructuredData`). No mock product ItemList. · **M**
- **6.12 `/checkout` indexable** (missing from `robots.ts` + no page noindex); **skip-to-content link** never shipped; **manifest** has only `favicon.ico` (no 192/512/maskable). · **S each**
- **6.13 Dialog/Sheet close buttons use physical `right-4` + English `sr-only "Close"`** in an RTL Persian app; latent physical-prop RTL bugs in unused primitives (carousel/button-group/alert). Use logical `end-*`, translate to "بستن". · **S**
- **6.14 Admin DataTable rows are mouse-only** (`data-table.tsx:261-268` `<tr onClick>` with no `role`/`tabIndex`/keydown); **image reorder is drag-only** (no keyboard/touch path — hero-slides-board already solved this with up/down buttons). · **S each**
- **6.15 Default icon button is 32px** (`button.tsx:29`) — below the 44px touch target across 19 components incl. destructive address delete. Bump the touch hit area. · **M**
- **6.16 Wishlist "add all to cart" reports success unconditionally** and fires N uncoordinated POSTs — use `useBulkAddCartItems` + report the real count. · **S**
- ~~**6.17 BlogPosting publisher has no `logo`**~~ — **done PR-080m**. `journalArticleLd` publisher `logo` is an `ImageObject` at `absoluteUrl(siteConfig.logo)` (same URL as `organizationLd`).
- **6.18 `getProductBySlug` does search-then-find** with `?? results[0]` fallback — a valid slug can render the wrong product. Add a real slug lookup / drop the fallback. · **S**
- **6.19 `auth.ts:37` logs the backend base URL on every boot** (no env guard); add FE `typecheck`/`test` scripts + `no-console` lint; no pre-commit hooks. · **S**
- **6.20 No DB backup strategy** (no `pg_dump`/sidecar/runbook); **floating `timescaledb:latest-pg17` tag** defeats reproducible deploys; **Dockerfile.dev `GOSUMDB=off`** weakens supply chain. · **S–M**
- **6.21 `db_retries_total` registered but has no alert rule** (metrics/rules drift). · **S**
- **6.22 Order-detail invoice/tracking are honest "coming soon" stubs** — backend has no invoice endpoint or shipment-tracking fields; acceptable for now, real feature later. · **L**
- **6.23 Seeder not truly idempotent on partial failure** (product created, variant not → unrepairable on re-run). Wrap each product's multi-step seed in one tx. · **M**
- **6.24 `lib/products.ts` mock module also houses core helpers** (`formatPrice`/`faNum`) imported by ~70 live files, and its mock `Category` union is cast onto live data. Move helpers to `lib/format.ts`. · **M**

---

## Recommended next slice

Ship one cohesive **"correctness + unblock + gate"** batch to `dev`. Reasoning: it's almost entirely **S-effort**, fixes things that are **provably broken in production**, and the CI gate protects everything else from regressing.

1. **1.1 price-filter SQL** (S) — a CRITICAL 500 on a standard catalogue facet; one-line predicate change + a repo test.
2. **1.2 add `"me"` to the BFF allow-list** (S) — one string revives the entire personalization surface (quiz + For-You rail + account card).
3. **3.1 `order_items` indexes** (S) — one `CONCURRENTLY` migration; the single biggest remaining scaling cliff, hit by order detail + the whole recommendation engine. Pairs naturally with **3.2 caching the recommendation rails** (M) if there's room.
4. **5.2 review-image IDOR + 5.3 `h.handleError` migration** (S) — the one genuinely new security hole, plus the residual 500→404 mapping the prior sweep missed (address/inventory/review/referral handlers + the untyped-error repos).
5. **4.1 CI workflow** (M) — the keystone: it runs the money/auth tests `1e2eb43` already wrote (currently never executed), adds `-race`, and stops any of the above from silently regressing.

This batch is ~4×S + 1–2×M, touches isolated surfaces (one repo method, one allow-list, one migration, a handful of handlers, one workflow file), carries low blast radius, and converts the largest "looks-done-but-broken" risks into verified-green. **Defer** the admin de-mocking epic (2.1/2.2, L) and the shipping-weight/search/email features to the following slice — they're higher effort and not actively breaking the live storefront.
