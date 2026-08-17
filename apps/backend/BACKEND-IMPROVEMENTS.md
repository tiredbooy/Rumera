# Rumera Backend — Improvement Backlog

> Generated from a 6-agent parallel audit (security, API/HTTP, data layer, architecture/concurrency, testing/observability, feature completeness). All findings cite `file:line` and were verified read-only against the code. Items flagged **⚑ cross-validated** were found independently by 2+ agents → highest confidence.

---

## ✅ Epic E status — shipped 2026-06-16 (commit on `dev`)

**Done (build + `go test ./...` green):**
- **#1 Free-money wallet top-up** — removed the public `POST /wallet/deposit` route + handler (`routes.go`, `handlers/wallet.go`). Wallet credit now only flows from payments/refunds/redemptions/admin.
- **#2 `models.Err*` → 500** — `category` and `brand` handlers now use `h.handleError`, so not-found/conflict map to 404/409.
- **#3 Order↔stock atomicity** — stock reservation moved **inside** the order-creation transaction via new `InventoryService.ReserveForOrderTx` (`order_svc.go`, `inventory_svc.go`). Closes the oversell window and the dangling-pending-order-on-crash case; on shortfall the whole order rolls back (no compensating cancel). Test updated → `TestCreateOrder_InsufficientStockRollsBack`.
- **#6 Insecure-default guards** — `Config.Validate()` now rejects, in production: JWT secret < 32 chars, CORS `*`, empty `CRYPTO_WEBHOOK_KEY`, and `SMS_PROVIDER=log` (which logs OTP codes). New `config_test.go` cases.
- **#8 Missing indexes** — migration `20260616130000_money_integrity_indexes.sql` adds CONCURRENTLY indexes on `payment_transactions(transaction_id)` / `(order_id,status)`, `wallet_transactions(wallet_id,created_at)`, `inventory_movements(product_variant_id,created_at)` / `(reference_order_id)`, `orders(paid_at)`.
- **#9 (partial) Proxy spoofing** — added `TRUSTED_PROXIES` config + `SetTrustedProxies` wiring so per-IP rate limits can't be spoofed via `X-Forwarded-For` (set it to the ingress range in prod).

**Previously deferred — now DONE 2026-06-16 (with an integration harness):**
- **Integration harness** — `tests/integration` now runs against a real Postgres via `TEST_DATABASE_URL` (no testcontainers: its dep `klauspost/compress` is 403-blocked by the sandbox proxy). `make test-integration`; skips cleanly when no DB. Runs `migrations/main` via goose, truncate-per-test isolation, real repos/services. See `tests/integration/README.md`.
- **#4 Payment→stock atomicity** — `Inventory.DeductForOrderTx` now runs inside `Payment.Confirm`'s transaction (`payment_svc.go`); the separate, error-discarding deduct was removed from the webhook handler. A failed deduct rolls back the confirm. Proven by `TestPaymentConfirm_DeductsStockAtomically` (also asserts no double-deduct on replay).
- **#5 Coupon usage-limit TOCTOU** — `CouponRepository.LockByID` (SELECT … FOR UPDATE) + `CountUsagesTx` give a row-locked re-check inside the order tx (`order_svc.enforceCouponLimitsTx`); the unlocked pre-tx check was removed. Proven under genuine concurrency by `TestCouponUsageLimit_HoldsUnderConcurrency`.
- **#9 Login limiter fail-open** — `LoginRateLimit` now falls back to a per-IP in-memory fixed-window limiter when Redis is absent/erroring, instead of allowing the request unconditionally. Unit-tested in `ratelimit_test.go`.

**Bonus bug found by the harness:** `order_items.product_variant_id` was referenced by `BulkCreate`/`GetItems` but never added by a migration — so **checkout failed at runtime**. Fixed in `migrations/main/20260616131000_order_items_variant.sql`.

**Still open (lower priority):** see the P2/P3 section (negative-stock guards, loyalty `Spend` idempotency, gift-card saga, `SELECT *` column-order fragility, etc.).

---

## 🔴 P0 — Fix first (money / auth / data integrity)

### 1. ⚑ Free-money wallet top-up — any customer can mint balance
`internal/handlers/wallet.go:27-42` · `internal/services/wallet_svc.go:49-78` · route `internal/routes/routes.go:190`
`POST /wallet/deposit` is a plain authenticated route; the service only checks `amount > 0`. No gateway charge, no admin gate. Any logged-in user can credit their own (spendable) wallet by any amount → buy goods for free.
**Fix:** Remove the public deposit route. Wallet credits must originate only from a verified payment webhook, refund, gift-card/loyalty redemption, or admin action. (Feature audit: FE actually wants a gateway-backed `POST /wallet/topup` — build that instead.)

### 2. ⚑ `models.Err*` sentinels return 500 instead of 404/409
API: `internal/handlers/category.go`, `brand.go` (raw `response.HandleError`) · Arch: `internal/models/errors.go:5-32` · `pkg/response/error.go:56-63`
153 handler call-sites use raw `response.HandleError` (only understands `*apperr.AppError`); services like `category_svc`/`brand_svc`/`address_svc`/`inventory_svc` return plain `models.Err*` sentinels → they fall through to a generic **500**. The fix already exists: `h.handleError` (`common.go:226`) maps these (order/recipe/media handlers use it).
**Fix:** Make `h.handleError` the single sanctioned error path; translate `models.Err*` → `apperr` in Group-B services. Add a startup test asserting every `apperr` code has a `codes.go` mapping.

### 3. ⚑ Order creation and stock reservation are in separate transactions → oversell
`internal/services/order_svc.go:118-167`
Order+items+coupon commit (`:139`), then `inventory.ReserveForOrder` runs in a *separate* tx (`:152`). Between them stock isn't held; concurrent orders oversell, and a crash leaves a dangling pending order (best-effort `Cancel` ignores its error).
**Fix:** Thread one `pgx.Tx` through order create + item bulk-create + coupon record **+ stock reserve** so they commit atomically. Clear cart / open payment only post-commit.

### 4. ⚑ Webhook "mark paid" and "deduct stock" are not atomic; error discarded
`internal/handlers/webhook.go:59-74` · `internal/services/payment_svc.go:122-165`
`Payment.Confirm` commits, then `Inventory.DeductForOrder` runs in a different tx and its error is dropped (`_ =`). If Deduct fails, order is paid but `committed_stock` never drains → permanent inventory drift. Same on the `failed`→Release branch.
**Fix:** Move stock deduction inside the `Confirm` transaction (or an idempotent retried outbox job). At minimum stop discarding the error.

### 5. Coupon usage-limit check is TOCTOU (race past `MaxUses`)
`internal/services/order_svc.go:229-248` (count outside tx) then `:134` (record)
Concurrent redemptions both read `used < max` and both insert → limit bypassed (revenue loss).
**Fix:** Enforce with a unique constraint (`UNIQUE(coupon_id,user_id)` for per-user) or re-check `FOR UPDATE` inside the recording tx.

### 6. ⚑ Insecure defaults not validated at startup
`configs/config.go` — `JWT_SECRET` unchecked (`:63`); `CORS_ALLOWED_ORIGINS default:"*"` (`:19`); `CryptoWebhookKey` no default/not required (`:120`); `SMS_PROVIDER default:"log"` logs OTP codes (`pkg/sms/sms.go:51`)
A weak/copied JWT secret = full auth forgery. Default `*` CORS ships open. Missing webhook key silently breaks all payment confirmation. `SMS=log` writes live OTP codes to logs.
**Fix:** In `Config.Validate()`: require `len(JWT_SECRET) >= 32` + reject placeholders; in production reject CORS `*`, empty `CryptoWebhookKey`, and `SMS_PROVIDER=log`.

### 7. No tests on critical money/auth paths + no CI gate
`tests/integration/` is a README only (0 `.go`); no `.github/workflows` (the `.golangci.yml:11` "CI runs it" claim is stale). Untested: `payment_svc.Confirm`/`Create`, `webhook.PaymentWebhook` orchestration, `wallet_svc.Deposit/Refund`, `loyalty`, RBAC `RequireRole`.
**Fix:** Add CI running `go test -race ./...` + `golangci-lint run` + coverage gate (Makefile targets already exist). Then test the P0 paths — mocks for Payment/Order/Wallet already exist; copy the `order_svc_test.go` pattern.

---

## 🟠 P1 — High value

| # | Theme | Finding · Evidence · Fix |
|---|-------|--------------------------|
| 8 | **DB indexes** ⚑ | `payment_transactions` has **no indexes** (hot webhook path seq-scans) — `migrations/main/...payment_transactions.sql`, queried by `transaction_id`/`order_id`/`status`. Also `wallet_transactions(wallet_id)`, `inventory_movements(product_variant_id, created_at)`, `orders(paid_at)`. **Fix:** one migration adding these (unique on `transaction_id`). *Quick, big latency win.* |
| 9 | **Rate-limit fail-open** | `LoginRateLimit` degrades **open** on Redis error (`middlewares/ratelimit.go:19-40`) → brute-force protection vanishes during cache outages. Also Gin trusts all proxies → `X-Forwarded-For` spoofs every IP limit (`bootstrap/newRouter.go` lacks `SetTrustedProxies`). **Fix:** fail closed (or in-memory fallback) for auth; set trusted proxies. |
| 10 | **OTP abuse** | Per-phone cap 5/hr + per-IP 10/min still allows SMS-bombing via rotating numbers; send is fire-and-forget (`handlers/auth_otp.go:40-85`). **Fix:** global hourly send budget + per-phone 60s cooldown + stricter per-IP on `/otp/request`. |
| 11 | **Idempotency** | Generic `Idempotency` middleware exists but is wired only to `POST /webhooks/payment` (`routes.go:35`). `POST /orders`, `/wallet/deposit|withdraw`, `/subscriptions`, `/gift-cards/redeem` have no replay protection → client retry double-charges. **Fix:** apply to financial/create routes, keyed by `Idempotency-Key`. |
| 12 | **Response consistency** | Three list-envelope shapes (`{data}` object, `{results,pagination}`, bare `{data:[]}`); several collections return **unbounded** arrays (`ListBlogs`, `ListSubscriptions`, `ListAlerts`, loyalty txns, addresses). **Fix:** one paginated list envelope everywhere; add `BaseFilter` pagination to the bare endpoints. |
| 13 | **Error correlation** | `ErrorBody` (`pkg/response/response.go:8-16`) has no `request_id`/`trace_id`, though `RequestID` middleware sets `X-Request-ID`. **Fix:** add `request_id` to error/success bodies from `c.GetString(RequestIDKey)`. |
| 14 | **Fire-and-forget goroutines** | `blog.go:38`, `recipe.go:77`, `order.go:66` spawn per-request goroutines: unbounded, lost on shutdown, **run outside Gin Recovery → a panic kills the process**; `blog.go:38` uses `context.Background()` no timeout. **Fix:** bounded worker pool + `recover()` + WaitGroup drained on shutdown. |
| 15 | **Analytics drain bug** | `queue.Start(ctx)` uses the *signal* context (`bootstrap/app.go:131`); on SIGINT workers exit before `Shutdown()` drains the buffer → buffered events lost. **Fix:** start workers with a background ctx so channel-close is the sole drain trigger. |
| 16 | **Business metrics** | `pkg/metrics` has solid infra metrics but **zero business counters** (orders placed/paid/cancelled, payment success/fail, revenue, inventory shortfall, OTP fail). Can't alert on "payment failure spiked." **Fix:** add counters, call them at P0 paths — unlocks the existing Grafana/Prometheus configs in `deploy/observability/`. |
| 17 | **Saga tracing** | OTel + otelgin + otelpgx are wired, but **no app-level spans** (`grep tracer.Start` → nothing). Multi-step sagas appear as one flat span. **Fix:** wrap `CreateOrder`, `Payment.Confirm`, `Inventory.*ForOrder` in named spans with order/txn attributes. |
| 18 | **Refund/returns flow incomplete** ⚑ | Order model defines `refund_*` statuses but transitioning to them does **nothing**: no wallet refund, no restock, no loyalty reversal, no `refunded_at`/`refund_amount` write — yet analytics already *reads* `refund_amount` (`corn/revenue_job.go:77`). No gateway `Refund`/`Void`. **Fix:** wire side-effects into `UpdateOrderStatus` + add `POST /orders/:id/refund-request` + payment-service refund. **(L)** |

---

## 🟡 P2 / P3 — Robustness, hygiene, features

**Data/correctness:** Release/Deduct lack `AND committed_stock >= qty` guard + idempotency → can go negative (`inventory_repo.go:204-245`); loyalty `Spend` not idempotent (`loyalty_repo.go:96`); gift-card redeem→wallet credit uncoordinated (`gift_card_svc.go:66`); `SELECT *` + positional `Scan` is column-order-fragile (`order_repo`/`wallet_repo`/`inventory_repo`); reservation loop unordered → deadlock risk (sort by `variant_id`).

**API/layering:** `GetProduct` does 4 serial service calls in the handler — move to `Product.GetDetail` service method (`product.go:87-119`); webhook does inventory orchestration inline (move to service); no OpenAPI spec + ~7 undocumented route groups (hero-slides, gift-cards, referrals, subscriptions, loyalty, taste-profile, alerts).

**Concurrency/hygiene:** cron batch limits hardcoded at 500 with no loop; loyalty/referral errors on paid orders silently swallowed (`payment_svc.go:157,161`); `pgx.ErrNoRows` translated inconsistently (some use `==` not `errors.Is`); package dir typo `internal/corn` → `cron`; lifecycle log typos (`main.go:18`, `app.go:148`).

**Caching:** `pkg/cache` (redis + circuit breaker) only used by media — add read-through caching for product/recipe detail, coupon-by-code, shipping methods, with write-time invalidation.

**Feature gaps (FE expects, BE missing):** `POST /wallet/topup` (FE `account-hooks.ts:62`), `GET /reviews/mine` (`:162`), `GET /reviews/pending` (`:172`), bare `GET /recommendations` (`:123`); confirm `/products/:id` resolves slugs not just numeric ids.

**High-value features to add:** abandoned-cart recovery (analytics already computes `carts_abandoned`/`cart_recovery_count` — nothing acts on it); order shipment tracking (no tracking#/carrier fields); search facets with counts + multi-select + in-stock/rating filters; order state-machine transition guard; gift-card balance lookup; stock-reservation TTL sweeper for abandoned pending orders (likely a leak); returns/RMA entity.

---

## ✅ Verified clean (non-findings, for confidence)
- SQL injection: all `fmt.Sprintf` in repos build *named placeholders*, never inject user values.
- IDOR: orders/reviews/wallet all enforce ownership in the service layer.
- JWT alg-confusion rejected; webhook uses constant-time HMAC; account enumeration safe; bcrypt cost 12; self-role-escalation blocked.
- Migrations have full down-coverage; `perf_indexes` uses `CONCURRENTLY`; pool config reasonable; ctx propagated to queries with statement/lock timeouts.
- DI single assembly point, fail-fast config validation, graceful HTTP shutdown, no god-files, cron runner recovers+drains.

---

## Recommended sequencing
1. **Day 1 quick wins (S, huge risk reduction):** #1 delete `/wallet/deposit`; #6 config `Validate()` guards; #8 index migration; #9 trusted proxies + fail-closed login limiter; #2 swap `category`/`brand` to `h.handleError`.
2. **Week 1 (money integrity):** #3 + #4 atomic order/stock + payment/stock; #5 coupon race; #11 idempotency on creates; #7 CI + tests for `Confirm`/`Create`/RBAC.
3. **Week 2 (observability + correctness):** #16 business metrics; #17 saga spans; #14 goroutine pool; #15 analytics drain; #13 request-id in errors.
4. **Backlog (features):** #18 refunds/returns; abandoned-cart; shipment tracking; search facets; FE↔BE gap endpoints.
