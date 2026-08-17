# Operations, Performance & Reliability

How the Rumera backend stays fast and dependable under load: caching strategy,
background jobs, health probes, graceful shutdown, server hardening, and the
environment knobs that tune them. This is the operator's companion to
[Architecture](./architecture.md).

---

## Health & readiness probes

Two distinct checks, deliberately separated so orchestrators can tell "the
process is alive" from "the process can serve traffic":

| Endpoint | Question it answers | Behaviour |
|----------|---------------------|-----------|
| `GET /health` | Is the process up? (liveness) | Always `200 {"status":"ok"}` while the process runs. Cheap; no dependency checks. |
| `GET /health/ready` | Can it serve traffic? (readiness) | Pings the main DB, analytics DB, and cache within a 2s budget. `200` only when all respond; otherwise `503` with a per-dependency status map. |

Wire liveness to your process supervisor / `livenessProbe`, and readiness to the
load-balancer / `readinessProbe` so a node with a flapping database is pulled
from rotation instead of serving errors.

```jsonc
// GET /health/ready  →  503 when a dependency is down
{
  "ready": false,
  "dependencies": { "main_db": "up", "analytics_db": "down", "cache": "up" }
}
```

---

## Caching strategy

### Read-through cache with stampede protection

Hot, expensive, read-heavy GETs (a featured recipe, the category tree) go
through `cachedJSON` (`internal/handlers/cache.go`):

1. **Fast path** — serve the stored JSON verbatim on a hit. The payload is kept
   as `json.RawMessage`, so it is handed straight into the response envelope with
   no re-encode.
2. **Slow path (miss)** — the build is run through
   [`singleflight`](https://pkg.go.dev/golang.org/x/sync/singleflight): concurrent
   requests for the **same key** collapse into a single `build()` call; the rest
   wait and share the result.

That second point is the important reliability property. Without it, when a hot
key expires under traffic every in-flight request misses simultaneously and
stampedes the database (the classic *thundering herd* / *cache stampede*). With
it, exactly one query runs and the herd is served from its result. This is
covered by a race-tested regression in `internal/handlers/cache_test.go`.

Caching degrades cleanly: a transient Redis error falls through to a direct
build (availability over cache freshness), and with no cache configured at all
the helper behaves identically, just without the cache reads/writes.

### Cache keys & invalidation

Keys are minted by helpers in `pkg/cache/cache.go` and **versioned** by prefix
(`product:v1:`, `recipe:v1:`, `category:v1:tree`). To invalidate an entire
namespace at once, bump its version prefix. Writes call `invalidate(...)` to
best-effort delete affected keys (never failing the write).

| Key helper | Caches |
|------------|--------|
| `KeyProduct(id)` | A product detail |
| `KeyCategoryTree()` | The full category tree |
| `KeyRecipe(slug)` | A hydrated public recipe detail |

### HTTP caching: ETag & Cache-Control

On top of the server-side Redis cache, the cacheable detail endpoints emit
client/CDN cache headers via `pkg/response/cache.go`, so a client holding a
current copy gets a bodyless `304 Not Modified` instead of the full payload:

| Endpoint | Helper | `Cache-Control` | Why |
|----------|--------|-----------------|-----|
| Product detail, Category tree | `response.CachedJSON` | `public, max-age=<ttl>` | No per-request side effects — safe for shared/browser caches to serve within the TTL. |
| Recipe detail | `response.RevalidateJSON` | `no-cache` | The endpoint **counts a view on every GET**; `max-age` would let clients skip the server and silently drop view counts. `no-cache` forces revalidation (view still fires) while a matching `ETag` still returns a tiny `304`. |

The `ETag` is a strong validator (a quoted FNV-1a 64 hash of the payload). Clients
echo it back in `If-None-Match`; on a match the handler returns `304` with no body.
Behaviour is covered by `pkg/response/cache_test.go`.

### Local media lifecycle

Original uploads under `MEDIA_ROOT` are authoritative. `MEDIA_CACHE_DIR` contains
only reproducible rendered variants and must never be included in backups. Media
replacement/removal and product or variant cascades detach database ownership
first, then best-effort delete the original plus its source-addressable render
namespace. A reference check protects historical/shared URLs.

Run orphan reconciliation in dry-run mode first and retain its JSON report:

```bash
./media-reconcile --min-age=24h > media-reconcile-dry-run.json
# Review the report, then copy its RFC3339 `cutoff` value exactly.
./media-reconcile --apply --cutoff=2026-07-25T12:00:00Z > media-reconcile-apply.json
```

The job uses a PostgreSQL advisory lock across the complete inventory/apply run,
so multiple backend processes cannot delete the same candidate concurrently.
New uploads younger than the cutoff are retained, covering active forms,
ambiguous database outcomes, and interrupted clients.

#### Backup and restore

Back up PostgreSQL and `MEDIA_ROOT` in the same quiesced write window. For the
production Compose stack, stop frontend/backend writes while leaving PostgreSQL
running, then capture both artifacts:

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml stop frontend backend
docker compose --env-file .env.prod -f docker-compose.prod.yml exec -T postgres \
  sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > rumera-db.dump
docker compose --env-file .env.prod -f docker-compose.prod.yml run --rm --no-deps \
  --entrypoint tar backend -C /data -czf - media > rumera-media.tgz
docker compose --env-file .env.prod -f docker-compose.prod.yml start backend frontend
```

Restore the database and originals from the same backup set while writes remain
stopped. Restore files under `/data/media`, ensure ownership is UID/GID `1001`,
delete `/data/media-cache`, start the backend, and run a reconciliation dry run.
Never restore a database snapshot and media archive from different write windows
without expecting the report to show missing references or orphans.

`docker compose down -v` destroys `media_data` as well as database volumes. It is
not a normal reset command when uploaded media must survive.

#### Process topology

Multiple backend processes are safe only when they mount the same POSIX
filesystem for both media directories; immutable writes are atomic and
reconciliation is globally locked in PostgreSQL. The bundled Compose topology is
single-node. Independent node-local volumes are unsupported because a request may
land on a process that cannot see the original. Use shared POSIX storage before
adding backend replicas; do not add object storage in this deployment.

Next.js cache-tag invalidation is process-local by default. The bundled frontend
is one process. Before horizontally scaling it, configure a shared Next cache and
`updateTags`/`refreshTags` coordination (for example through Redis), otherwise
replicas can serve different hero/category ISR generations after an admin write.

---

## Metrics & observability

The backend exposes Prometheus metrics at **`GET /metrics`** (toggle with
`METRICS_ENABLED`, default `true`). Keep this endpoint on an internal network —
it is unauthenticated. The middleware (`pkg/middleware/metrics.go`) times the full
handler chain and the series live in `pkg/metrics/metrics.go`.

| Metric | Type | Labels | Meaning |
|--------|------|--------|---------|
| `http_requests_total` | counter | `method`, `route`, `status` | Request count. `route` is the **matched template** (`/api/v1/products/:id`), not the raw path, so IDs don't explode cardinality; unmatched requests collapse to `route="unmatched"`. |
| `http_request_duration_seconds` | histogram | `route` | Request latency (default buckets). Use for p50/p95/p99. |
| `cache_requests_total` | counter | `result` (`hit`/`miss`/`error`) | Read-through cache outcomes → cache hit ratio. |
| `db_pool_{total,acquired,idle,max}_conns` | gauge | `pool` (`main`/`analytics`) | Live pgx pool stats, read at scrape time. `acquired` approaching `max` = pool saturation. |
| `analytics_queue_depth` / `analytics_queue_capacity` | gauge | `queue` (`events`) | Buffered analytics events vs buffer size. Depth trending toward capacity = back-pressure, events about to drop. |

Go runtime and process collectors are included automatically (goroutines, GC, heap,
fds, CPU). The registry is private to the app — only the series above (plus runtime)
are exposed, nothing leaks from third-party default registries.

Suggested starting alerts (formal rules land with roadmap item A3): p99
`http_request_duration_seconds` over budget, `http_requests_total` 5xx rate,
`db_pool_acquired_conns / db_pool_max_conns` near 1, `analytics_queue_depth` near
capacity, and a rising `cache_requests_total{result="error"}` rate.

---

## Background jobs (cron)

An in-process scheduler (`internal/corn`, built on `robfig/cron/v3`) runs
recurring work. It is assembled in `bootstrap.buildCron`, started after the HTTP
listener is up, and stopped — waiting for any in-flight job to finish — before
the database pools it depends on are closed.

Schedules are **6-field cron expressions** (seconds enabled) evaluated in **UTC**.
Panics inside a job are recovered so one bad run never kills the process, and
each run is bounded by a 30-minute context.

| Job | Default schedule | What it does |
|-----|------------------|--------------|
| `product_stats` | `0 15 2 * * *` (02:15) | Rolls up yesterday's per-product analytics into the analytics DB |
| `revenue_stats` | `0 30 2 * * *` (02:30) | Rolls up yesterday's revenue metrics |
| `search_summary` | `0 45 2 * * *` (02:45) | Rolls up yesterday's search terms, clicks, conversions |
| `recommendation_refresh` | `0 0 3 * * *` (03:00) | Rebuilds affinity profiles for recently-active users |
| `idempotency_cleanup` | `0 30 3 * * *` (03:30) | Prunes `idempotency_keys` (+ product aggregate ops) older than `IDEMPOTENCY_KEY_RETENTION` (default **720h / 30d**) |

Idempotency ops (inspect keys, stuck reclaim, FE headers):  
[architecture/idempotency-runbook.md](./architecture/idempotency-runbook.md).

Schedules are staggered so the nightly aggregations don't hit the analytics DB
all at once.

### Recommendation profile refresh

`GET /recommendations/for-you` reads a precomputed affinity profile. Before this
job existed, a cache miss forced the profile to be computed **inline on the
request** — aggregating a user's entire interaction + order history while they
waited. The nightly refresh pre-warms profiles for everyone active in the last
`CRON_RECS_REFRESH_WINDOW_DAYS` days (capped at `CRON_RECS_REFRESH_MAX_USERS`,
most-recently-active first), so the request path stays a fast read.

The job is resilient: one user's failure is logged and skipped, never aborting
the batch, and it honours context cancellation for a clean shutdown. Lazy
on-demand computation still happens on the first `/for-you` for a brand-new user,
and `POST /recommendations/profile/recompute` forces a rebuild on demand.

### Disabling the scheduler

Set `CRON_ENABLED=false` to run the API without the in-process scheduler — useful
when a dedicated worker process owns the jobs, or to scale the API horizontally
without running every replica's cron. The API serves identically; only the
background roll-ups are skipped.

---

## HTTP server hardening

The server (`internal/bootstrap/app.go`) sets conservative timeouts so a slow or
hostile client can't tie up resources:

| Setting | Value | Protects against |
|---------|-------|------------------|
| `ReadHeaderTimeout` | 5s | Slowloris — clients that dribble request headers to hold connections open |
| `ReadTimeout` | 15s | Slow request bodies |
| `WriteTimeout` | 15s | Slow response consumers |
| `IdleTimeout` | 60s | Idle keep-alive connection exhaustion |
| `MaxHeaderBytes` | 1 MiB | Header-bomb requests |

A request-scoped `timeout` middleware (30s) and per-request DB
`statement_timeout` (30s) / `lock_timeout` (10s) (`pkg/database/pool.go`) bound
work further down the stack.

---

## Rate limiting

A **per-client-IP** token-bucket limiter (`pkg/middleware/ratelimit.go`) caps
request rate (default 100 req/s, burst 200) so one client can't crowd out
others. Idle visitor buckets are garbage-collected every 3 minutes. Over-limit
requests get `429` with a `Retry-After` header.

Client IP comes from Gin's `c.ClientIP()`, which honours `X-Forwarded-For` only
from hops listed in `TRUSTED_PROXIES`. Production `Validate()` refuses to boot
with an empty list (Gin's default is "trust every hop", which makes login/OTP
and the global limiter spoofable). The prod compose stack sets
`TRUSTED_PROXIES=172.16.0.0/12` (Docker user-defined bridge; nginx → backend)
and prod nginx **resets** `X-Forwarded-For` to `$remote_addr` rather than
appending a caller-supplied header. Do not set `0.0.0.0/0`.

---

## Graceful shutdown

On `SIGINT`/`SIGTERM` the app shuts down in dependency order so nothing is torn
down while still in use:

1. Stop accepting new HTTP connections, drain in-flight requests (10s budget).
2. Stop the cron scheduler and wait for any running job to finish.
3. Drain buffered analytics events through their workers.
4. Close the database pools and the cache client.
5. Flush logs.

---

## Connection pooling

Both database pools (`pkg/database`) are sized and health-checked: bounded
max/min connections, max connection lifetime and idle time, and a periodic
health check (1 minute). Each connection is pinned to UTC with an
`application_name` of `rumera` for easy identification in `pg_stat_activity`.

---

## Configuration reference (operational)

All via environment variables (see `configs/config.go`).

| Variable | Default | Purpose |
|----------|---------|---------|
| `CRON_ENABLED` | `true` | Master switch for the in-process scheduler |
| `CRON_PRODUCT_STATS_SCHEDULE` | `0 15 2 * * *` | Product-stats roll-up schedule |
| `CRON_REVENUE_STATS_SCHEDULE` | `0 30 2 * * *` | Revenue-stats roll-up schedule |
| `CRON_SEARCH_SUMMARY_SCHEDULE` | `0 45 2 * * *` | Search-summary roll-up schedule |
| `CRON_RECS_REFRESH_SCHEDULE` | `0 0 3 * * *` | Recommendation-profile refresh schedule |
| `CRON_RECS_REFRESH_WINDOW_DAYS` | `30` | Look-back window for "active" users to refresh |
| `CRON_RECS_REFRESH_MAX_USERS` | `5000` | Per-run cap on profiles rebuilt |
| `REDIS_ADDR` / `REDIS_PASSWORD` / `REDIS_DB` | `localhost:6379` / – / `0` | Cache backend |
| `CORS_ALLOWED_ORIGINS` | `*` | Browser origin allow-list (set explicitly in prod) |
| `TRUSTED_PROXIES` | – | Ingress IPs/CIDRs trusted for `X-Forwarded-For`. **Required in production**; compose default `172.16.0.0/12`. Do not use `0.0.0.0/0`. |
| `METRICS_ENABLED` | `true` | Expose the Prometheus `/metrics` endpoint + request metrics middleware (keep internal-only) |
| `MEDIA_ROOT` | `./storage/media` | Authoritative uploaded originals; persist and back up |
| `MEDIA_CACHE_DIR` | `./storage/media-cache` | Disposable rendered variants; safe to clear |
| `MEDIA_MAX_UPLOAD_MB` | `15` | Maximum compressed source file size |
| `MEDIA_MAX_DIMENSION` | `4000` | Maximum requested transform width or height |
| `MEDIA_MAX_SOURCE_DIMENSION` | `12000` | Maximum decoded source width or height |
| `MEDIA_MAX_SOURCE_PIXELS` | `40000000` | Maximum decoded source pixel count |

> Cron schedules are 6-field (`sec min hour dom mon dow`) and evaluated in UTC.
