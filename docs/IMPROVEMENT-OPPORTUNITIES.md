# Rumera — Improvement Opportunities (re-audit)

> **Dated 2026-06-20.** This document **supersedes** the prior sweep (the previous version of this file and `apps/backend/BACKEND-IMPROVEMENTS.md` — git keeps the history). It is the consolidated output of an **11-agent re-audit run AFTER commit `1e2eb43`** (which implemented 16 planned changes: admin categories/brands/recipe-builder/hero-slides/edit-user, site-settings API, blog enhancements, PDP reviews+recommendations+wishlist, `cmd/seed` seeder, auth token-refresh). Many prior items are now genuinely **resolved** — see the first section. Everything below was re-verified against current source.
>
> Audit dimensions: BE security/money, BE perf/DB, BE quality/API, BE testing, FE UX, FE a11y/RTL/SEO, FE perf, FE quality/types, FE↔BE contract drift, DevOps/CI/observability, product/feature gaps.
>
> **⚑ = cross-corroborated** by 2+ independent auditors → highest confidence. Effort: **S** ≤ half-day · **M** ~1–3 days · **L** multi-day.

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

**1.3 ⚑ blog & recipe service "transactions" are no-ops — relation writes are NOT atomic** · *BE quality + BE perf/DB* · **HIGH**
- **Evidence:** `blog_svc.go:161-181,211-257` and `recipe_svc.go:146-167,206-247` do `tx := s.db.Begin(); … tx.Commit()`, but `s.repo.Create/AssignCategories/AssignProducts/AssignTags/CreateIngredients` all execute on the **pool** (`r.db`) — the repos never accept a `pgx.Tx`. The tx contains zero statements.
- **Problem:** Each junction write commits independently as it executes; if a later assign fails, the already-written row/relations can't be rolled back → orphaned post/recipe with partial relations. The `1e2eb43` "atomic persistence" claim is true only for products (`product_repo.go:61` threads the tx through `insertVariantTx`).
- **Fix:** Thread `pgx.Tx` through tx-aware repo methods (use `product_repo` as the template), or drop the misleading Begin/Commit. · **M**

### Epic 2 — Admin console is half-mock (operators act on fabricated data)

**2.1 ⚑ Orders / inventory / reviews / analytics admin screens render `lib/admin/data.ts` mock data** · *FE quality + contract-drift + feature-gaps* · **HIGH** (corroborated by 3 auditors)
- **Evidence:** `app/admin/orders/page.tsx` → `orders-table.tsx:4` (`adminOrders`); `app/admin/inventory/page.tsx:7` + `inventory-table.tsx:8`; `reviews-queue.tsx:9`; `app/admin/analytics/page.tsx:6` + `analytics-view.tsx:13` (`revenueSeries`/`topProducts`). Real backend endpoints exist and are unused: `routes.go:279-281` (orders), `:301-307` (inventory), `:337-348` (11 analytics endpoints). `admin-client.ts` has no order/inventory/analytics methods. The **customers** screen proves the migration pattern (`app/admin/customers/page.tsx:7` `serverApi`).
- **Problem:** Operators see fabricated revenue, orders, stock, and an entirely fictional analytics board; decisions are made on invented numbers. The `1e2eb43` admin redesign was only half-migrated.
- **Fix:** Add `admin-client` methods mirroring `listUsers` and server-prefetch real data (orders/inventory first — operational; analytics second). Delete the mock exports + the dead `lib/api/admin-hooks.ts`. · **L**

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

**5.1 ⚑ Checkout fetches shipping with hardcoded `weight=0` (and fixed region `"IR"`)** · *FE perf + contract-drift* · corroborated
`checkout-flow.tsx:182` `useShippingMethods(SHIP_REGION, 0)`; products carry `weight` but cart weight is never summed; backend filters tiers/thresholds by both region+weight (`shipping.go:130-140`). Every shopper is quoted shipping as if the parcel weighs 0g, and the query key never invalidates on cart change. Sum variant weights and derive region from the chosen address. · **M**

**5.2 IDOR: any user can attach arbitrary image URLs to ANY review** · *BE security* · the lone new security hole (top-of-medium)
`review.go:164-180` AddReviewImage never calls `h.uid(c)`; `review_svc.go:206-229` AddImage only does an existence check (unlike Update/Delete which pass userID); `ReviewImageReq.ImageURL` (`models/review.go:99-104`) has no validation tag. A logged-in user can POST images onto any review by iterating numeric ids, and the unvalidated URL renders on the public PDP (stored-content/URL-injection). Pass the caller's userID, verify ownership, add `validate:"required,url,max=2048"`. · **S**

**5.3 ⚑ address & inventory handlers still return 500 for not-found/conflict** · *BE security + BE quality* · corroborated
`address.go` and `inventory.go` (and review/referral handlers) call raw `response.HandleError`, which only understands `*apperr.AppError`; wrapped `models.Err*` falls through to 500. The `1e2eb43` `h.handleError` migration covered category/brand/recipe/hero/site_settings but missed these. Also `blog_category`/`review_image`/`search_summary` repos return untyped string not-found errors (no `%w` sentinel), so even `h.handleError` can't rescue them. Swap to `h.handleError` and return `models.ErrNotFound` from those repos; add a startup test asserting every `models.Err*` maps. · **S**

**5.4 Admin stock `Adjust` no-ops on a missing inventory row yet records a phantom movement** · *BE security/data-integrity*
`inventory_repo.go:151-174` UPDATEs with no `RowsAffected()` check then unconditionally inserts an `inventory_movements` row; service commits regardless; handler returns 204. Wrong/un-seeded variant id → orphan movement + false success; negative adjust below 0 hits the CHECK constraint as a raw 500. Check `RowsAffected()==0 → ErrNotFound`, guard the negative case, route through `h.handleError`. · **S**

**5.5 Unordered stock-reservation loop → deadlock risk between concurrent orders** · *BE perf/DB*
`order_svc.go:152-156` reserves in cart order; two checkouts with the same variants in opposite order acquire row locks in conflicting order → Postgres 40P01 mid-checkout. Sort the reservation slice by `VariantID` (and in Release/Deduct) for consistent global lock ordering. · **S**

**5.6 `payment_transactions.transaction_id` index is non-unique** · *BE perf/DB*
`20260616130000:11-12` creates a plain index; the gateway txid is the natural idempotency key, so a webhook replay/race can insert duplicates. Replace with `CREATE UNIQUE INDEX CONCURRENTLY` (after de-dup). · **S**

**5.7 Three account hooks call backend endpoints that don't exist** · *contract-drift + FE quality*
`account-hooks.ts:151` bare `recommendations`, `:190` `reviews/mine`, `:200` `reviews/pending` (all tagged `TODO(api): confirm`) → `NoRoute` 404. "My Reviews", "Reviews to write", and the account recommendation widget always error/empty. Add the routes or repoint at existing ones; also fix the `RecommendedProduct.id` vs backend `product_id` shape drift by adopting the already-correct `RecommendationItem` type. · **M**

**5.8 Server analytics middleware writes an empty `Payload` → all search-analytics reports are empty** · *feature-gaps*
`middlewares/analytics.go:69` sets `Payload: map[string]any{}` and never populates it, but `corn/search_job.go` reads `payload->>'query'/'results_count'/'product_id'/'filter_name'`. Even once the admin UI is wired (2.1), top-terms/zero-result/top-converting/filter-breakdown stay empty. Populate the payload in `buildEvent` for search/PDP/filter requests. · **M**

**5.9 Site-settings admin update is read-modify-write with no row lock** · *BE security*
`site_settings_svc.go:39-52` Get→merge-in-Go→Update with no `FOR UPDATE`/version check; two concurrent admin saves clobber each other. Lock the singleton row or add optimistic-concurrency. · **S**

**5.10 Cart mutations have no optimistic update, no remove toast/undo** · *FE UX*
`hooks.ts:38-91` use only `onSuccess`; `cart-lines.tsx:22` a single shared `busy` flag dims **all** lines on any tap; remove (`:90`) shows no toast and no undo (prior Epic-B ask). The wishlist hooks already implement the gold-standard `onMutate`+rollback. Copy that pattern, scope disabled state per-item, add remove toast with undo. · **M**

**5.11 Fire-and-forget goroutines run outside Gin Recovery** · *BE security + BE quality* · corroborated
`auth_otp.go:76-82`, `recipe.go:77-83`, `blog.go:47` (the last with bare `context.Background()`, no timeout) spawn detached goroutines with no `recover()`; a panic crashes the process. Wrap in a defer-recover helper / bounded worker pool. · **S–M**

**5.12 Observability infra authored but inert; no app/business metrics; no saga spans** · *DevOps*
`/metrics` + Prometheus rules + Grafana dashboard exist but **nothing scrapes them** (no prometheus/grafana/otel-collector service in compose, no scrape config). No business counters (orders/payments/revenue/inventory) and no app-level tracing spans, so a payment-gateway outage returning 200 is invisible. Add an `observability` compose profile + scrape config; add `tracer.Start` spans + counters at the order/payment/inventory saga boundaries. · **M** (each)

**5.13 Prod backend has no compose healthcheck; frontend waits on `service_started`** · *DevOps*
`docker-compose.prod.yml` backend has no `healthcheck`; frontend `depends_on: { condition: service_started }`, so it comes up before the backend can reach Postgres/Redis/Meili → 5xx flapping every deploy. The new deep `/health/ready` probe is wired into zero healthchecks. Add a `/health/ready` healthcheck + `service_healthy`. · **S**

**5.14 nginx prod edge: no security headers, `server_tokens` on, no rate limit, TLS commented out** · *DevOps*
`infra/nginx/nginx.prod.conf` leaks nginx version, ships no HSTS/X-Frame-Options/X-Content-Type-Options on `/api/v1`/`/media`, no L7 rate limit on auth/OTP, plaintext only. Add `server_tokens off`, `limit_req`, security headers, and a real 443 block. · **M**

**5.15 `@sentry/nextjs` declared but completely unwired** · *DevOps*
No `instrumentation*.ts`, no `withSentryConfig`, no `Sentry` references — FE errors are unobserved in prod and the SDK ships dead. Wire it (Next 16 `instrumentation`) or remove. · **M**

**5.16 Account overview fires 6 client queries on mount with no server prefetch** · *FE perf*
`account-overview.tsx:64-70` calls 6 hooks post-hydration; zero `HydrationBoundary`/`dehydrate` in the repo. The page is already a server component — prefetch + `HydrationBoundary` (PDP reviews are the template). · **M**

**5.17 `components/ui/table.tsx` is `"use client"`; recharts not code-split** · *FE perf*
The table primitive is purely presentational yet forces the whole admin subtree to client-render — delete line 1. recharts is eagerly bundled (`grep next/dynamic` = 0 hits repo-wide); wrap chart components in `next/dynamic`. Admin-only blast radius. · **S / M**

**5.18 `images.remotePatterns` allows `hostname:"**"`** · *FE perf/security*
`next.config.ts:46` lets the image optimizer proxy any HTTPS origin (SSRF / open-proxy surface). Restrict to the concrete media/CDN hosts. · **S**

**5.19 Personalization starved: `purchase`(10) and `add_to_cart`(4) signals never recorded** · *feature-gaps*
FE records only `view` + `wishlist`; the engine ranks by a score dominated by the two highest-weight edges that the UI never creates. Fire `add_to_cart` in `add-to-cart-button.tsx` onSuccess and `purchase` on order-confirmation. Cheap, directly powers the now-live rails. · **S**

**5.20 Multiple `<h1>` on the home page (one per off-screen hero slide)** · *FE a11y/SEO*
`hero-carousel.tsx:164` renders an `<h1>` per slide; embla keeps all slides in the DOM. Render the active slide's title as `<h1>`, others as `<h2>`/`aria-hidden`. · **M**

**5.21 RBAC `RequireRole` and refresh-token rotation are untested** · *BE testing*
`auth.go:70-84` (the only admin gate) and `auth_tokens.go` single-use rotation have no tests; the cache-absent path silently disables rotation (replay window). Add `auth_test.go` + a fake-cache `consumeRefresh` test. · **S–M**

---

## 🟢 Low / polish

- **6.1 Product-card wishlist heart missing** · *feature-gaps* — wishlist CRUD only reachable from the PDP panel (`catalog/product-card.tsx` has no heart). Biggest place wishlisting drives return visits. Add a heart using `useHasWishlistItem`/`useAdd/Remove`. · **M**
- **6.2 ⚑ Dead npm deps** · *FE perf + FE quality* — axios, qs, uploadthing, lodash-es, zustand, nanoid, @tanstack/react-virtual, react-day-picker, vaul, cmdk, react-resizable-panels (+ dead shadcn primitives) all have zero importers; posthog-js/@sentry installed-not-initialized. Remove after a final grep. · **M**
- **6.3 `/wallet/withdraw` debits balance with no payout integration** · *BE security* — half-built money-destroying customer endpoint; remove until a real off-ramp exists or gate behind admin approval. · **S**
- **6.4 `isBusinessError` uses `==` not `errors.Is`** (`inventory_svc.go:217-225`); **`search_summary_repo` compares `pgx.ErrNoRows` with `==`** — latent landmines on the money path; switch to `errors.Is`. · **S**
- **6.5 ⚑ Inconsistent error path** — 122 `response.HandleError` vs 70 `h.handleError` call-sites, mixed within single files. Make `h.handleError` the only sanctioned path + a grep-based CI ban. · **M**
- **6.6 Order-confirmation email is English, hardcoded HTML, IRR as `%.2f`** on a Persian/RTL Toman store (`order.go:60-65`). Replace with a Persian RTL template + Toman formatting + order lines. · **M**
- **6.7 Product search is title-only ILIKE** — no pg_trgm, no Persian normalization (ك/ي→ک/ی), no ZWNJ handling, no brand/category/description match, no facets (`product_repo.go:192-195`). · **L**
- **6.8 Per-user lists unbounded** — `subscription_repo`/`alert_repo` `ListByUser` have no LIMIT. Add `LIMIT 100`. · **S**
- **6.9 Admin user list: no index on `role`/`created_at`, `SELECT *` + positional 18-col Scan** (`user_repo.go:156-247`) — column-order fragile + full scan on the new customers page. Add indexes, explicit column list. · **S**
- **6.10 DB pool sizing hardcoded** (`db.go:28-29` maxConns 25); surface `DB_MAX_CONNS`/`DB_MIN_CONNS`. · **S**
- **6.11 ⚑ Storefront home "featured" rail + its JSON-LD render 8 hardcoded mock bottles** (`page.tsx:32,76,208` → mock `lib/products.ts`; `structured-data.tsx`) while the page renders live data elsewhere — Google structured-data mismatch risk. Two same-named `ProductCard` exports with incompatible props. Switch to live catalog + the server `catalog/product-card`. · **M**
- **6.12 `/checkout` indexable** (missing from `robots.ts` + no page noindex); **skip-to-content link** never shipped; **manifest** has only `favicon.ico` (no 192/512/maskable). · **S each**
- **6.13 Dialog/Sheet close buttons use physical `right-4` + English `sr-only "Close"`** in an RTL Persian app; latent physical-prop RTL bugs in unused primitives (carousel/button-group/alert). Use logical `end-*`, translate to "بستن". · **S**
- **6.14 Admin DataTable rows are mouse-only** (`data-table.tsx:261-268` `<tr onClick>` with no `role`/`tabIndex`/keydown); **image reorder is drag-only** (no keyboard/touch path — hero-slides-board already solved this with up/down buttons). · **S each**
- **6.15 Default icon button is 32px** (`button.tsx:29`) — below the 44px touch target across 19 components incl. destructive address delete. Bump the touch hit area. · **M**
- **6.16 Wishlist "add all to cart" reports success unconditionally** and fires N uncoordinated POSTs — use `useBulkAddCartItems` + report the real count. · **S**
- **6.17 BlogPosting publisher has no `logo`** (`journal/[slug]/page.tsx:83`); reuse `organizationLd`'s logo. · **S**
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
