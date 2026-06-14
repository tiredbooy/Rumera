# Backend Improvement Roadmap

> Goal: make the backend **faster, more reliable, more maintainable** without disturbing
> its already-solid architecture (clean layering, real repository interfaces, ACID
> transactions, graceful shutdown, stampede-protected cache).
>
> **Target scale:** single instance for now. Choices keep horizontal scaling possible
> later without over-engineering today.
>
> Status legend: `TODO` · `IN PROGRESS` · `DONE` · `DEFERRED`

## Status snapshot — end of day 2026-06-13

**Done (9):** C1 (indexes + N+1) · C2 (HTTP cache headers + ETag) · A1 (Prometheus metrics) ·
C3 (stats-job CTE, byte-identical — **Phase 1 complete**) · A3 (Grafana dashboard + Prometheus alerts) ·
A2 (OpenTelemetry tracing, default off — **Phase 2 complete**) · B2 (graceful Redis degradation + circuit
breaker) · B3 (transient-failure retry layer) · B4 (payment/webhook idempotency keys — **Phase 3 complete**).
All compile clean, gofmt/vet clean, unit-tested, full suite green.

**Phase 4 progress:** D1 (money-path tests + mocks) ✅ · D4 (CI + golangci-lint + make targets) ✅ ·
D3 (integration) — harness + docs shipped, implementation **blocked** by the sandbox proxy (testcontainers
dep 403s; enable on open network/CI) · **D2 remaining** (uniform service interfaces) — mechanical but
overlaps the active hero_slide WIP in `container.go`/`handler.go`, so best done once that work lands.

| ID | Title | What's left to do |
|----|-------|-------------------|
| **C3** | Consolidate stats-job queries | Pure refactor of `internal/corn/stats_job.go` `aggregateForProduct()`: fold its 5 sequential `QueryRow` calls (views, funnel, device, source, revenue) into one CTE so the daily job does one DB round-trip per product instead of five. Output must stay byte-identical. No new deps, no DB needed to write. **Closes Phase 1.** |
| **A2** | OpenTelemetry tracing | Add otel + `otelgin` + pgx instrumentation. New `pkg/tracing/tracing.go` `Init(cfg)→(shutdown,err)`, OTLP endpoint/sampler from config, **default off** (`OTEL_ENABLED=false`). Wire `Init` in `app.go New()`, add `otelgin.Middleware` in `setupMiddlewares.go`, add `shutdown()` to the ordered teardown. Add `trace_id` to the zap fields in `pkg/middleware/logger.go` so logs join traces. |
| **A3** | Dashboards & alerts | Config artifacts only (no code): `deploy/observability/grafana-dashboard.json` (RED + db_pool + queue panels off the A1 metrics) and `prometheus-rules.yml` (p99 latency, 5xx rate, pool-exhaustion, queue-saturation, cache-error-rate alerts). |
| **B2** | Graceful Redis degradation | `pkg/cache/redis.go:35` currently hard-fails startup on a Redis ping. Change `app.go`/`container.go` to log a warning and continue with `cache=nil` (the nil path is already handled everywhere). Add `pkg/cache/circuit.go` — a `Store` wrapper with a circuit breaker (N consecutive failures → short-circuit to `ErrNotFound` for a cooldown, then probe). Readiness reports cache `"degraded"` (still 200) instead of gating on it. |
| **B3** | Retry layer | `go-retry` is in go.mod but unused. New `pkg/database/retry.go` `WithRetry(ctx, fn)` with bounded exponential backoff, retrying **only** transient pgx errors (serialization `40001`, conn reset) — never business errors. Apply to idempotent reads + the cron rollups. Unit-test with a fail-twice-then-succeed fake. |
| **B4** | Idempotency keys | New migration `idempotency_keys(key PK, request_hash, response_code, response_body, created_at)`. New `pkg/middleware/idempotency.go` keyed on the `Idempotency-Key` header / `transaction_id`: first call records + processes, duplicate returns the stored response without re-running the side effect. Apply to webhook + payment-confirm routes in `routes.go`. Prevents double order-paid on callback retries. |
| **D2** | Uniform service interfaces | `handlers.Deps` (`container.go:107`) mixes interface-typed services (Brand, Category, Blog, Order…) with concrete `*services.XService` (User, Product, Variant, Tag, Cart, Coupon, Wishlist, Wallet, Review, Shipping, Payment, Event, …). Export an interface per concrete service, have the constructor return it, update the `Deps` field types. Mechanical, compiler-guided, one service at a time. **Unblocks handler mocking — do before D1.** |
| **D1** | Service tests + mocks | New `internal/mocks/` with repository mocks for the money paths (Order, Cart, Coupon, Inventory, Payment, Wallet). Table-driven `internal/services/*_test.go` for `OrderService.CreateOrder` (cart states, coupon valid/expired, shipping, payment open/fail, compensation), `InventoryService.Reserve/Release/Deduct`, `WalletService` insufficient-funds, `CouponService` validation. |
| **D3** | Integration suite | Add `testcontainers-go`. New `tests/integration/` behind `//go:build integration`: spin up Postgres + Redis, run migrations, exercise the full checkout flow (add-to-cart → coupon → place order → confirm payment incl. B4 idempotency replay) and assert inventory deducted. Keep unit runs fast (tag-gated). |
| **D4** | CI quality gate | New `.github/workflows/ci.yml`: `golangci-lint` + `go vet` + `go test ./...` + coverage threshold + a migration up/down check on a throwaway DB. Add a golangci-lint config and `make lint` / `make test-integration` targets. |

**Recommended next session order:** C3 (finish Phase 1) → A3 (cheap, builds on A1) → A2 → B2/B3/B4 → D2 → D1 → D3 → D4.

**Environment note for picking up:** several remaining items want a live DB (C1's EXPLAIN check, B-series, D3). The Rumera stack is **not** currently running — bring it up with `apps/backend/docker-compose.yml` (Postgres+TimescaleDB+Redis), then `make migrate-up` + `make analytics-up`. The only Postgres container currently up is an unrelated `tracker_db` — don't point migrations at it.

**Deferred (single instance):** B1 (Redis-distributed rate limiting) and B5 (outbox saga) — see bottom of this doc.

## Themes

| Theme | Focus | Why |
|-------|-------|-----|
| A — Observability | Prometheus metrics, OpenTelemetry tracing, dashboards | Currently zero metrics/tracing — flying blind in prod |
| B — Reliability | Graceful Redis degradation, retries, payment idempotency, outbox | Harden against dependency failure & callback retries |
| C — Performance | N+1 fix, indexes, HTTP cache headers, stats-job consolidation | Cheap, high-confidence latency wins |
| D — Testing | Service unit tests + mocks, uniform interfaces, integration suite, CI | Money paths (order/payment/inventory) are untested |

## Sequencing

```
Phase 1  Performance quick wins      (C) — low risk, immediate, no new deps
Phase 2  Observability               (A) — instrument before changing behavior
Phase 3  Reliability & resilience    (B) — build on Phase 2 metrics
Phase 4  Testing & quality gate      (D) — lock in everything above
```

Do the cheap perf wins first (C), **instrument before hardening** (A before B) so B's
changes are measurable, then freeze it all behind tests (D).

---

## Phase 1 — Performance (Theme C)

### C1 — Fix N+1 + add missing indexes · `DONE (code)` · live EXPLAIN pending DB
**Problem:** `order_repo.GetItems()` (~`internal/repositories/order_repo.go:264`) fires a
correlated `product_images` subquery per order item; several hot filter/join columns are
unindexed.

**Tasks:**
- [x] New migration `migrations/main/20260613110000_perf_indexes.sql` (`-- +goose NO TRANSACTION`):
  - `idx_product_images_primary` partial on `product_images(product_id) WHERE is_primary` (serves GetItems)
  - `idx_product_images_variant` partial on `product_images(product_variant_id) WHERE … NOT NULL`
  - `idx_orders_user_created` on `orders(user_id, created_at DESC)` (the existing single-column
    `idx_orders_user_id` couldn't satisfy the ListMyOrders sort)
- [x] New analytics migration `migrations/analytics/20260613110000_events_product_index.sql`:
      btree expression `idx_events_product_id` on `events((payload->>'product_id'))` — the
      existing GIN(payload)/(event_type,created_at) indexes don't serve the `= $1` equality.
- [x] Rewrote `order_repo.GetItems()` correlated subquery → index-backed `LEFT JOIN LATERAL … LIMIT 1`
      (identical semantics). Removed stale leftover comments.
- [x] `go build ./...` clean, `gofmt` clean, vet clean on repositories, goose annotations valid.
- [ ] **Pending:** live `EXPLAIN ANALYZE` before/after — needs the Rumera DB stack up
      (only an unrelated `tracker_db` Postgres is currently running).

**Acceptance:** order-detail plan shows index scans, no per-row subplan; migration up/down clean.

### C2 — HTTP cache headers + ETag · `DONE`
**Tasks:**
- [x] New `pkg/response/cache.go` (placed in `response`, next to `OK`, rather than `middleware`
      — it writes the envelope, so it belongs with the response helpers):
  - `CachedJSON(c, data, ttl)` → strong `ETag` (FNV-1a 64) + `Cache-Control: public, max-age=<ttl>`,
    `304` on matching `If-None-Match`. For product detail + category tree.
  - `RevalidateJSON(c, data)` → strong `ETag` + `Cache-Control: no-cache`. For the recipe endpoint,
    which **counts a view on every GET** — `max-age` would let clients skip the server and silently
    drop view counts, so it must always revalidate (still gets a bodyless `304` when unchanged).
  - 304 uses `AbortWithStatus` to flush the bodyless header immediately.
- [x] Routed product (`product.go`), category tree (`category.go`), recipe (`recipe.go`) through them.
- [x] Unit tests `pkg/response/cache_test.go`: 200+headers, 304-on-match, fresh-ETag-on-change,
      no-cache directive, `etagMatches` (`*` / weak `W/` / list). All pass.
- [x] `go build ./...`, `gofmt`, `go vet` clean.

**Acceptance:** ✅ repeat GET with `If-None-Match` → `304`; first response carries `ETag` + `Cache-Control` (proven by tests).

### C3 — Consolidate stats-job queries · `DONE`
**Tasks:**
- [x] In `internal/corn/stats_job.go` `aggregateForProduct()`, folded the 5 sequential
      `QueryRow` calls into one CTE (`WITH base AS (...) SELECT <conditional aggregates>`).
      Single scan of the day-and-product event slice; every breakdown computed via
      `FILTER` clauses that reproduce each former query's `WHERE` exactly (views/source/
      revenue keep their `event_type` scoping; funnel/device span all types).
- [x] Verified byte-identical: old-vs-new `EXCEPT` diff against a seeded TimescaleDB
      hypertable returned `diff_rows = 0` (registered/guest, distinct sessions, every
      referrer category, device types, revenue sum, plus noise rows correctly excluded).

**Acceptance:** ✅ job output identical; one DB round-trip per product.

---

## Phase 2 — Observability (Theme A)

### A1 — Prometheus metrics · `DONE`
- [x] Added dep `github.com/prometheus/client_golang v1.23.2` (go.mod/go.sum).
- [x] New `pkg/metrics/metrics.go` — private registry + helpers:
  - `http_requests_total{method,route,status}` (counter), `http_request_duration_seconds{route}` (histogram)
  - `db_pool_{total,acquired,idle,max}_conns{pool}` gauges via `pool.Stat()` (read at scrape time)
  - `cache_requests_total{result=hit|miss|error}` counter
  - `analytics_queue_depth{queue}` + `analytics_queue_capacity{queue}` gauges
  - Go runtime + process collectors. `register()` tolerates duplicates (init-safe). `Handler()` serves it.
- [x] New `pkg/middleware/metrics.go` — gin middleware labelled by `c.FullPath()` (bounded cardinality;
      unmatched → `"unmatched"`); inserted in `setupMiddlewares.go` after `Logger`, gated by `MetricsEnabled`.
- [x] `/metrics` registered in `newRouter.go` (gated by `MetricsEnabled`, internal-only).
- [x] Cache counters wired at the fast-path `Get` in `handlers/cache.go` (hit/miss/error switch).
- [x] `Queue.Depth()` / `Queue.Capacity()` added in `internal/analytics/queue.go`; pools + queue gauges
      registered once at startup in `app.go` (gated by `MetricsEnabled`).
- [x] New config flag `METRICS_ENABLED` (default `true`) in `configs/config.go`.
- [x] Tests `pkg/metrics/metrics_test.go`: scrape exposes RED series, cache results, live queue gauges
      (value updates between scrapes), duplicate-registration tolerated. All pass; full suite green.

**Acceptance:** ✅ `/metrics` lists RED + pool + cache + queue series; histogram + counters move under load
(proven by scrape tests). Live `EXPLAIN`-style load verification optional once the stack is up.

### A2 — OpenTelemetry tracing · `DONE`
- [x] Added deps `go.opentelemetry.io/otel` (+ sdk/trace/otlptracegrpc), `otelgin`,
      `github.com/exaring/otelpgx` (pgx instrumentation).
- [x] New `pkg/tracing/tracing.go`: `Init(ctx,cfg,log) (ShutdownFunc, err)`; OTLP/gRPC
      endpoint + parent-based ratio sampler from config, default off (`OTEL_ENABLED=false`,
      no-op shutdown + no global provider when disabled).
- [x] Wired `tracing.Init` in `app.go` `New()` **before** DB connect (so the pgx tracer
      captures the real provider); `otelgin.Middleware` in `setupMiddlewares.go` (gated,
      placed early); `tracerShutdown` added to the ordered teardown in `app.go`.
- [x] pgx query spans via `otelpgx.NewTracer()` on both pools when enabled.
- [x] Added `trace_id` to zap fields in `pkg/middleware/logger.go` (logs ↔ traces join).
- [x] Tests: `tracing.Init` disabled/enabled paths + logger `traceID` helper. Build/vet/fmt clean.

**Acceptance:** ✅ wiring complete & unit-tested; default-off path proven. Live span emission is
collector-dependent (point `OTEL_EXPORTER_OTLP_ENDPOINT` at a collector + flip `OTEL_ENABLED=true`).

### A3 — Dashboards & alerts · `DONE`
- [x] New `deploy/observability/grafana-dashboard.json` — RED (request rate, 5xx ratio,
      p50/p95/p99 latency incl. per-route), DB pool conns + utilisation gauge, cache outcomes,
      analytics queue depth/saturation. Importable; datasource + route are template vars.
- [x] New `deploy/observability/prometheus-rules.yml` — 5 alerts (p99 latency, 5xx rate,
      pool exhaustion, queue saturation, cache error rate). Validated with `promtool check rules`.

---

## Phase 3 — Reliability (Theme B)

### B2 — Graceful Redis degradation · `DONE`
- [x] `app.go` build: on boot ping failure, **logs a warning and continues with
      `cacheStore = nil`** instead of aborting (`a.cache.Close()` guarded against nil).
- [x] New `pkg/cache/circuit.go`: `Store` wrapper with a circuit breaker (N consecutive
      failures → open → short-circuit for a cooldown → single half-open probe). Open-state
      degrades per op: `Get`→`ErrNotFound` (rebuild), `Set`/`Delete`→no-op,
      `Incr`/`Exists`/`TTL`/`Ping`→`ErrUnavailable`. A miss never trips it. Wraps the live
      store in `app.go`. Config `CACHE_BREAKER_THRESHOLD`/`CACHE_BREAKER_COOLDOWN`.
- [x] Readiness reports cache `"disabled"`/`"degraded"`/`"up"` and never gates the probe.
- [x] Tests: open-after-threshold, short-circuit-without-store-call, probe recovery,
      failed-probe re-open, miss-does-not-trip.

**Acceptance:** ✅ degradation + breaker state machine unit-proven; live kill-Redis check needs a full app boot.

### B3 — Retry layer for transient failures · `DONE`
- [x] New `pkg/database/retry.go`: `WithRetry(ctx, fn)` (+ `WithRetryPolicy` for tests),
      bounded exponential backoff via `go-retry`, retrying only transient errors
      (serialization `40001`, deadlock `40P01`, `pgconn.SafeToRetry`) — never business
      errors or cancelled contexts. Default policy set from config in `database.Connect`
      (`DB_RETRY_MAX_ATTEMPTS`/`DB_RETRY_BASE_BACKOFF`); `db_retries_total` metric.
- [x] Applied to the product-stats cron rollup's idempotent reads.
- [x] Tests: fail-twice-then-succeed, stop-on-business-error, exhaust, disabled,
      cancelled-context, `isTransient` table.

**Acceptance:** ✅ proven by unit tests; retry metric counts attempts.

### B4 — Idempotency keys for payments/webhooks · `DONE`
- [x] New migration `20260614130000_create_idempotency_keys.sql`:
      `idempotency_keys(key PK, request_hash, response_code, response_body, created_at)`
      (+ created_at index). Up/down + atomic-claim verified on live Postgres.
- [x] New `pkg/middleware/idempotency.go`: keys on the `Idempotency-Key` header else a
      hash of method+path+body (identical webhook retries dedupe). Atomic claim
      (`INSERT … ON CONFLICT DO NOTHING`) → run handler → store 2xx response; replay returns
      it without re-running; in-flight/different-body → 409; non-2xx releases the claim;
      fail-open on store error. Wired onto `POST /webhooks/payment` in `routes.go`.
- [x] Tests: replay-processes-once, distinct-bodies-both-process, failed-handler releases claim.

**Acceptance:** ✅ replaying the webhook processes once; the replay returns the stored response (no double order-paid).

### B5 — Outbox pattern (saga durability) · `DEFERRED` (stretch)
**Problem:** order creation commits the order tx, then runs inventory reserve / cart clear
outside it with manual compensation (`order_svc.go:152-162`).
- [ ] New migration `..._create_outbox.sql`: `outbox(id, aggregate, event_type, payload, status, created_at)`.
- [ ] In `order_svc.go`, insert the "reserve inventory" intent into `outbox` **within** the order tx.
- [ ] New `internal/corn/outbox_job.go` relay (registered in `buildCron`, `container.go:181`),
      at-least-once + B4 idempotency guard.

> Ship B2/B3/B4 first. B5 is highest-effort, touches checkout core, and depends on B4.

### B1 — Redis-distributed rate limiting · `DEFERRED`
Not needed for single instance — in-memory token bucket (`setupMiddlewares.go:24`) is correct.
Revisit when adding a second replica. Seam: `setupMiddlewares.go:24`.

---

## Phase 4 — Testing & quality gate (Theme D)

### D2 — Uniform service interfaces · `TODO` (do first — unblocks mocking)
`handlers.Deps` (`container.go:107`) mixes interface-typed services (Brand, Category, Blog)
with concrete `*services.XService` (User, Product, Variant, Tag…). Concrete ones can't be mocked.
- [ ] Export an interface per concrete service; constructor returns it; update `Deps` field types.
      Mechanical, one service at a time, compiler-guided.

### D1 — Service unit tests + repo mocks · `DONE`
- [x] New `internal/mocks/` — hand-written func-field mocks (zero-value defaults, compile-time
      interface assertions) for the money-path repos (Order, OrderItem, Cart, Coupon,
      CouponUsage, ShippingMethod, Inventory, Movement, Wallet, Payment) + a no-op `pgx.Tx`.
- [x] New `internal/services/*_test.go` — table-driven: `OrderService.CreateOrder` (empty cart,
      invalid shipping, invalid/expired coupon, happy path, insufficient-stock compensation),
      `InventoryService.Reserve/Release/Deduct`, `WalletService` insufficient-funds + guards,
      `CouponService.Validate` + pure `computeDiscount`. 17 cases green, vet clean.

### D3 — Integration suite · `BLOCKED (env)` — harness + docs shipped
- [x] `tests/integration/README.md` — harness design (full checkout flow + B4 idempotency
      replay + inventory-deducted assertion) and one-command enable path. `make test-integration`
      target shipped with D4.
- [ ] **Blocked here:** `go get testcontainers-go` 403s on `klauspost/compress@v1.18.5` (a
      transitive dep) behind the dev sandbox's module proxy. Resolves on an open network / CI —
      run the `go get` in the README, then implement the cases.

### D4 — CI quality gate · `DONE`
- [x] New `.github/workflows/ci.yml`: lint (golangci-lint) · test (`go vet` + `go test ./...`
      with a 5% coverage floor, a ratchet over today's 6%) · migrations (Postgres + TimescaleDB
      service containers, goose up + reset for `main` and `analytics`).
- [x] New `.golangci.yml` (errcheck/govet/ineffassign/staticcheck/unused/gofmt/goimports/
      misspell/unconvert) + `make lint` / `test-unit` / `test-integration` / `cover` targets.

---

## Cross-cutting conventions

- Every new behavior gets an env flag in `configs/config.go` (`OTEL_ENABLED`, `METRICS_ENABLED`,
  retry bounds, breaker thresholds), defaulting to safe/off — consistent with the existing
  envconfig pattern.
- Each item ships independently: code + migration + verification, one phase at a time.

## Effort & risk

| Phase | Items | New deps | Risk | Size |
|-------|-------|----------|------|------|
| 1 — Perf | C1, C2, C3 | none | low | S |
| 2 — Observability | A1, A2, A3 | prometheus, otel | low (additive) | M |
| 3 — Reliability | B2, B3, B4 (+B5 stretch) | none | med (touches checkout) | M–L |
| 4 — Testing | D2, D1, D3, D4 | testcontainers | low | L |
