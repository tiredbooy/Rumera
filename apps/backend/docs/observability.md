# Observability

How the Rumera backend exposes telemetry — Prometheus metrics, OpenTelemetry
traces, health probes — and how to stand up the Prometheus + Grafana stack that
scrapes and visualizes it.

This is the operator-facing companion to the short
[Metrics & observability](./operations.md#metrics--observability) section in
[Operations](./operations.md). Everything here is grounded in the running code
under [`pkg/metrics`](../pkg/metrics), [`pkg/tracing`](../pkg/tracing) and
[`internal/bootstrap`](../internal/bootstrap).

---

## What's installed

| Piece | Where | Endpoint / output | Toggle (env) | Default |
|-------|-------|-------------------|--------------|---------|
| Prometheus metrics | [`pkg/metrics/metrics.go`](../pkg/metrics/metrics.go), [`pkg/middleware/metrics.go`](../pkg/middleware/metrics.go) | `GET /metrics` (Prometheus text format) | `METRICS_ENABLED` | `true` |
| OpenTelemetry tracing | [`pkg/tracing/tracing.go`](../pkg/tracing/tracing.go) | OTLP/gRPC spans to a collector | `OTEL_ENABLED` | `false` |
| Grafana dashboard | [`deploy/observability/grafana-dashboard.json`](../deploy/observability/grafana-dashboard.json) | "Rumera Backend — RED + Pools + Queue" (uid `rumera-backend-red`) | — | auto-provisioned in dev |
| Alert rules | [`deploy/observability/prometheus-rules.yml`](../deploy/observability/prometheus-rules.yml) | 6 alerts in 3 groups | — | auto-loaded in dev |
| Liveness probe | [`internal/routes/routes.go`](../internal/routes/routes.go) | `GET /health` | — | always on |
| Readiness probe | [`internal/bootstrap/newRouter.go`](../internal/bootstrap/newRouter.go) | `GET /health/ready` | — | always on |

The `/metrics` endpoint, the request-timing middleware, and the DB-pool/queue
gauge registration are **all** gated by `METRICS_ENABLED` — turn it off and none
of those exist. Tracing is gated entirely by `OTEL_ENABLED`; when off, the tracer
provider, the `otelgin` HTTP middleware, and the `otelpgx` query tracer are all
no-ops.

---

## Current state

The development stack starts Prometheus and Grafana automatically. Prometheus
scrapes the backend's `/metrics`; Grafana auto-provisions the datasource and the
Rumera API dashboard. Production keeps observability as a separate stack so its
ports and credentials can be isolated from public application traffic.

Tracing still exports to nowhere by default. With `OTEL_ENABLED=false` it does
nothing; if you flip it on today, the default endpoint `localhost:4317` resolves
to nothing inside the container (no collector service exists), so spans silently
fail to export.

---

## Quick start: stand up the stack

In development, Prometheus and Grafana join the same compose network as the API,
and Prometheus scrapes `backend:8080/metrics` by service name.

```bash
# Prometheus and Grafana are included; no second compose command is needed.
make dev-up
```

For **production** (project name `rumera` → network `rumera_rumera_network`),
override the network at launch:

```bash
cd apps/backend/deploy/observability
OBS_NETWORK=rumera_rumera_network docker compose -f docker-compose.observability.yml up -d
```

### URLs & credentials

| Service | URL | Notes |
|---------|-----|-------|
| Prometheus | <http://localhost:9090> | Targets at `/targets`, rules at `/rules` |
| Grafana | <http://localhost:3001> | Login `admin` / `admin` (or `GRAFANA_ADMIN_PASSWORD`) |

> Grafana runs on **3001** — the frontend already publishes **3000**.

### Confirm the backend target is UP

1. Open <http://localhost:9090/targets> — the `rumera-backend` job, target
   `backend:8080`, should be **UP**.
2. Sanity-check a series:
   <http://localhost:9090/graph?g0.expr=http_requests_total>.
3. Confirm rules loaded: <http://localhost:9090/rules> shows the
   `rumera-backend-availability`, `-saturation` and `-cache` groups.
4. Open Grafana at <http://localhost:3001> — the Prometheus datasource and the
   **Rumera Backend — RED + Pools + Queue** dashboard are auto-provisioned.

Hot-reload Prometheus after editing `prometheus.yml` (no restart needed):

```bash
curl -X POST http://localhost:9090/-/reload
```

In development, stop only the monitoring services while leaving the application
running with:

```bash
docker compose --env-file .env.dev -f docker-compose.dev.yml stop prometheus grafana
```

For production's separate observability stack, tear it down with:

```bash
docker compose -f docker-compose.observability.yml down
```

---

## Metrics catalogue

All series come from a **private** registry owned by
[`pkg/metrics/metrics.go`](../pkg/metrics/metrics.go) — nothing leaks from
third-party default registries. The `route` label is the matched Gin route
**template** (`c.FullPath()`, e.g. `/api/v1/products/:id`), so IDs don't explode
cardinality; unmatched requests collapse to `route="unmatched"`.

| Metric | Type | Labels | Meaning |
|--------|------|--------|---------|
| `http_requests_total` | counter | `method`, `route`, `status` | Total HTTP requests by method, matched route template and status code. |
| `http_request_duration_seconds` | histogram | `route` | Request latency in seconds (`prometheus.DefBuckets`: .005 → 10s). Latency is **only** labelled by route — not method/status. |
| `cache_requests_total` | counter | `result` (`hit`/`miss`/`error`) | Read-through cache outcomes → cache hit ratio. |
| `db_retries_total` | counter | — | DB operations retried after a transient (serialization/connection) error; one increment per retry attempt. |
| `cache_circuit_state` | gauge | — | Cache circuit-breaker state: `0`=closed, `1`=half-open, `2`=open. |
| `db_pool_total_conns` | gauge | `pool` (`main`/`analytics`) | Total connections in the pgx pool (acquired + idle). |
| `db_pool_acquired_conns` | gauge | `pool` | Connections checked out; approaching `max` = saturation. |
| `db_pool_idle_conns` | gauge | `pool` | Idle connections available. |
| `db_pool_max_conns` | gauge | `pool` | Max connections the pool is configured to hold. |
| `analytics_queue_depth` | gauge | `queue` (`events`) | Buffered analytics events awaiting flush; trending toward capacity = back-pressure. |
| `analytics_queue_capacity` | gauge | `queue` | Max events the buffer holds before dropping. |

The `db_pool_*` and `analytics_queue_*` gauges are `GaugeFunc` values read at
**scrape time** from `pool.Stat()` / the live queue, and are registered in
[`internal/bootstrap/app.go`](../internal/bootstrap/app.go) only when
`METRICS_ENABLED` is true. Go runtime and process collectors (goroutines, GC,
heap, open FDs, CPU) are included automatically.

> **No business metrics exist.** There is no series for orders, payments,
> revenue, or inventory — those domains are services/repositories with no
> Prometheus instrumentation. See [the gaps](#production--security).

### Useful PromQL

```promql
# Request rate (req/s) by route, 5m window
sum by (route) (rate(http_requests_total[5m]))
```

```promql
# p95 latency per route
histogram_quantile(0.95, sum by (le, route) (rate(http_request_duration_seconds_bucket[5m])))
```

```promql
# 5xx error rate (share of all requests)
sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m]))
```

```promql
# Cache hit ratio
sum(rate(cache_requests_total{result="hit"}[5m])) / sum(rate(cache_requests_total[5m]))
```

```promql
# DB pool saturation for the main pool (alert near 1)
db_pool_acquired_conns{pool="main"} / db_pool_max_conns{pool="main"}
```

```promql
# Analytics queue back-pressure (depth vs capacity)
analytics_queue_depth{queue="events"} / analytics_queue_capacity{queue="events"}
```

> There is no `in-flight` / concurrent-requests gauge today — the closest
> available signal is request rate (`rate(http_requests_total[…])`) combined with
> latency. An in-flight gauge would need a new metric (see
> [Adding a new metric / span](#adding-a-new-metric--span)).

---

## Tracing

OpenTelemetry tracing is **fully wired but off by default**
([`pkg/tracing/tracing.go`](../pkg/tracing/tracing.go)). When enabled it
installs:

- an **OTLP/gRPC** exporter (`WithInsecure` — no TLS, keep it internal),
- a batching `TracerProvider` with a `ParentBased(TraceIDRatioBased)` sampler,
- W3C TraceContext + Baggage propagators,
- auto-instrumentation: inbound HTTP server spans via **otelgin**, and a span
  per query via **otelpgx** on **both** the main and analytics pgx pools.

The logger middleware also pulls the active `trace_id` into every request log
line for log↔trace correlation.

### Environment variables

| Var | Default | Meaning |
|-----|---------|---------|
| `OTEL_ENABLED` | `false` | Master switch for the provider + otelgin + otelpgx. |
| `OTEL_SERVICE_NAME` | `rumera-backend` | `service.name` resource attribute and otelgin server name. |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `localhost:4317` | Collector address as `host:port`, **no scheme** (OTLP/gRPC). |
| `OTEL_SAMPLER_RATIO` | `1.0` | Head-sampling probability for root spans (0..1). Validated at boot. |

### Point it at a collector

Add an OTLP-capable backend on `rumera_network`. Jaeger all-in-one ingests
OTLP/gRPC on `4317` directly — no separate collector needed. Add to your dev
compose:

```yaml
  jaeger:
    image: jaegertracing/all-in-one:1.62
    container_name: rumera_jaeger_dev
    environment:
      COLLECTOR_OTLP_ENABLED: "true"
    ports:
      - "16686:16686"   # Jaeger UI
      - "4317:4317"     # OTLP/gRPC
    networks: [rumera_network]
```

Then set on the `backend` service:

```dotenv
# OpenTelemetry — turn it on and point at a collector on rumera_network.
# Endpoint is host:port, NO scheme (OTLP/gRPC, exported insecurely — keep internal).
OTEL_ENABLED=true
OTEL_SERVICE_NAME=rumera-backend
OTEL_EXPORTER_OTLP_ENDPOINT=jaeger:4317
# Sample everything in dev; lower in prod (0..1, validated at boot):
OTEL_SAMPLER_RATIO=1.0
```

Verify end-to-end: with OTEL on, each HTTP request produces an otelgin server
span with child otelpgx query spans; the request log line's `trace_id` should
match the trace in the Jaeger UI (<http://localhost:16686>).

### Span-coverage gaps

The app relies **only** on otelgin (HTTP boundary) and otelpgx (per-query) —
there are **zero custom spans**. The blind spots:

- **Order-creation saga** ([`internal/services/order_svc.go`](../internal/services/order_svc.go)):
  `BeginTx → coupon limits → inventory reserve → commit → pending payment` emits
  no domain spans; you see leaf SQL spans with no parent operation grouping them.
- **Payment webhook** ([`internal/handlers/webhook.go`](../internal/handlers/webhook.go)):
  the money path that confirms orders/payments is untraced beyond the generic
  server span.
- **Order-cancellation compensation** (inventory release on cancel) is untraced.
- **Redis cache layer** ([`pkg/cache`](../pkg/cache)) has no `redisotel` hook —
  cache round-trips never appear as spans.
- **Cron jobs** ([`internal/corn`](../internal/corn)) run outside any trace
  context, so their DB work is untraceable.
- The trace **resource** carries only `service.name` — no `service.version`,
  `deployment.environment`, or host attributes.
- The exporter is **hardwired insecure** (`WithInsecure`), so a managed/remote
  OTLP endpoint over TLS needs a code change.

---

## Alerts & dashboard

### Alert rules — [`prometheus-rules.yml`](../deploy/observability/prometheus-rules.yml)

Six alerts in three groups. **Every selector hardcodes `job="rumera-backend"`** —
the scrape job *must* be named exactly that (it is, in the provided
`prometheus.yml`) or the alerts evaluate over zero series and never fire.

| Alert | Group | Fires when | For | Severity |
|-------|-------|-----------|-----|----------|
| `HighRequestLatencyP99` | availability | p99 `http_request_duration_seconds` per route > 1s | 10m | warning |
| `HighServerErrorRate` | availability | 5xx ratio > 5% (with a request-rate floor) | 5m | critical |
| `DBPoolNearExhaustion` | saturation | `db_pool_acquired / db_pool_max` > 0.9 | 5m | warning |
| `AnalyticsQueueSaturated` | saturation | `analytics_queue_depth / capacity` > 0.8 | 5m | warning |
| `HighCacheErrorRate` | cache | cache `result="error"` ratio > 5% (with floor) | 5m | warning |
| `CacheCircuitOpen` | cache | `cache_circuit_state >= 2` (open) | 1m | warning |

### Dashboard — [`grafana-dashboard.json`](../deploy/observability/grafana-dashboard.json)

"Rumera Backend — RED + Pools + Queue" (uid `rumera-backend-red`, 30s refresh).
It has a multi-select **route** template variable and uses **no** job selector,
so it lights up regardless of job name. Two rows:

- **RED — Rate / Errors / Duration:** request rate by route, 5xx error ratio
  (red threshold 0.05), p50/p95/p99 latency (all routes), p99 latency by route.
- **Resources — DB pools, cache, queue:** DB pool connections by pool, DB pool
  utilisation gauge (yellow 0.75 / red 0.9), cache outcomes (stacked ops/s),
  analytics queue depth vs capacity, queue saturation gauge (yellow 0.6 /
  red 0.8).

> The dashboard supplies a `DS_PROMETHEUS` datasource template variable that
> auto-resolves to the provisioned Prometheus datasource — no manual import is
> needed. Note `db_pool_total_conns` and `db_retries_total` are emitted but not
> referenced by either artifact (unused instrumentation, not a broken ref).

---

## Adding a new metric / span

### A new metric

Register it once in [`pkg/metrics/metrics.go`](../pkg/metrics/metrics.go) on the
private `registry`, expose an increment/observe helper, then call it from the
relevant code path. Example — a business counter for created orders:

```go
// pkg/metrics/metrics.go
var ordersCreated = prometheus.NewCounterVec(
    prometheus.CounterOpts{
        Name: "orders_created_total",
        Help: "Orders successfully created, by status.",
    },
    []string{"status"},
)

func init() {
    registry.MustRegister(ordersCreated) // alongside the existing series
}

// IncOrderCreated records a created order.
func IncOrderCreated(status string) { ordersCreated.WithLabelValues(status).Inc() }
```

Then call `metrics.IncOrderCreated("pending")` from the order service. Keep label
values **bounded** (no raw IDs, emails, or free-form strings) or you'll blow up
cardinality.

### A custom span

Grab a tracer from the global provider (live whenever `OTEL_ENABLED=true`) and
wrap the operation. Always `defer span.End()` and record errors:

```go
import "go.opentelemetry.io/otel"

func (s *OrderService) Create(ctx context.Context, in CreateOrder) (*Order, error) {
    ctx, span := otel.Tracer("order-service").Start(ctx, "OrderService.Create")
    defer span.End()

    // ... saga steps; pass ctx down so otelpgx spans nest under this one ...
    if err != nil {
        span.RecordError(err)
        return nil, err
    }
    return order, nil
}
```

Passing `ctx` down to repository calls makes the otelpgx query spans children of
your custom span, giving you the saga grouping that's
[currently missing](#span-coverage-gaps).

---

## Health & readiness

Two distinct probes — use the right one for the right job.

| Probe | Path | Checks | On failure |
|-------|------|--------|------------|
| Liveness | `GET /health` | Nothing — returns `200 {"status":"ok"}` if the process is up | restart the container |
| Readiness | `GET /health/ready` | Pings the **main DB** and **analytics DB** (gating); reports cache as non-gating (`up`/`degraded`/`disabled`); 2s timeout | `503` — stop routing traffic |

- `/health` is a pure process-up signal — use it as the container/orchestrator
  **liveness** probe.
- `/health/ready` gates on both Postgres pools: if either `Ping` fails the probe
  returns `503` and the instance should be pulled from the load balancer. Cache
  state is reported but **does not** gate readiness (the app degrades gracefully
  to the DB when Redis is down). Use it as the **readiness** probe.

---

## Production & security

- **Keep `/metrics` internal.** The endpoint is **unauthenticated** by design —
  it must stay off the public ingress, reachable only on `rumera_network`. In
  prod the backend host port is bound to `127.0.0.1` (`BACKEND_BIND`), so
  Prometheus scrapes over the internal network (`backend:8080`), never the
  host-published port.
- **Pin image tags.** The provided compose pins `prom/prometheus:v2.54.1` and
  `grafana/grafana:11.2.0` — keep them pinned (avoid `:latest`) for reproducible
  rollouts.
- **Change Grafana credentials.** Set `GRAFANA_ADMIN_PASSWORD` (and
  `GRAFANA_ADMIN_USER`) — the default `admin`/`admin` is for local dev only.
- **Tracing has no TLS.** The OTLP exporter is hardwired `WithInsecure`; front
  the collector on a trusted/internal network until that's made configurable.

### Gaps to close

- **No business metrics** — orders, payments, revenue, and inventory have zero
  real-time visibility via `/metrics`. Add counters/gauges as shown in
  [Adding a new metric](#adding-a-new-metric--span).
- **No saga/webhook spans** — the order-creation saga, payment webhook, cancel
  compensation, Redis cache, and cron jobs are invisible between the HTTP span
  and leaf SQL spans.
- **Latency histogram is route-only** — you cannot compute p95 for just `POST`s
  or just 5xx; latency is aggregated across all methods/statuses per route.

See [Operations](./operations.md#metrics--observability) for the caching,
cron-job, graceful-shutdown and hardening context that surrounds this telemetry.
