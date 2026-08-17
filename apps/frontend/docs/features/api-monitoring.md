# API performance monitoring (Task 061l)

## Overview

Admin UI at **`/admin/monitoring`** (permission `analytics:read`) reads live
series from **Prometheus**, which scrapes the Go backend at **`GET /metrics`**.

Grafana remains available for deep dives; the in-app board covers the day-to-day
ops questions: is the service up, how hard is it working, how slow, how errorful,
and is the cache healthy.

## Architecture

```
Browser (admin)
    │
    ▼
Next.js /admin/monitoring  ──server──►  Prometheus HTTP API
                                            │
                                            │ scrape 15s
                                            ▼
                                      backend:8080/metrics
                                      (pkg/metrics registry)
```

| Component | Location |
|-----------|----------|
| In-app board | `features/admin/monitoring/*`, `app/admin/monitoring` |
| PromQL helpers | `lib/queries.ts` (unit tested) |
| Compose stack | `apps/backend/deploy/observability/` |
| Backend series | `http_requests_total`, `http_request_duration_seconds`, `cache_requests_total`, `cache_circuit_state`, `up` |

## Run observability stack (dev)

```bash
make dev-up

# Prometheus UI
open http://localhost:9090
# Targets → rumera-backend should be UP (scrapes backend:8080/metrics)

# Grafana (admin/admin by default)
open http://localhost:3001
```

### Frontend env

```bash
# Server-side only (Next container → Prometheus; set by dev compose)
PROMETHEUS_URL=http://prometheus:9090

# Optional link on the board
NEXT_PUBLIC_GRAFANA_URL=http://localhost:3001
```

Outside Docker, use `PROMETHEUS_URL=http://localhost:9090` instead.

## Truthful empty states

| Condition | UI |
|-----------|-----|
| `PROMETHEUS_URL` unset | «پیکربندی نشده» + setup steps |
| Timeout / connection error | «در دسترس نیست» |
| Queries succeed but empty series | Charts show «داده‌ای برای این بازه نیست»; KPIs show «—» |

## Time-series charts (PR-100e)

`MonitoringCharts` renders req/s, 5xx %, and p95 as TanStack Charts `areaY` +
`lineY` (not Recharts). Empty series keep the local ChartCard copy. X ticks and
point labels use `fa-IR` clock times; series paint comes from CSS vars
(`--primary`, `--destructive`, `--chart-2`). Analytics `Charts.tsx` is unchanged.

## Security

- Page requires admin session + `analytics:read`.
- Prometheus should stay on private networks (compose / VPC). Do not expose
  `:9090` publicly without auth.
- Backend `/metrics` is unauthenticated by design — keep it internal.

## Verification

```bash
# Unit
cd apps/frontend && npx vitest run features/admin/monitoring

# Manual
curl -s http://localhost:8080/metrics | head
curl -s 'http://localhost:9090/api/v1/query?query=up'
# open /admin/monitoring as analytics-capable admin
```
