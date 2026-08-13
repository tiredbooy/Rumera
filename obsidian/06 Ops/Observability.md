---
tags:
  - ops
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 06 Ops]]


# Observability

- Prometheus metrics on backend (`GET /metrics`)
- OpenTelemetry tracing hooks (`OTEL_ENABLED`, default off → no-op spans)
- Admin monitoring board (PromQL) → [[Admin Console]]
- Grafana compose under backend deploy/observability

## Money / stock saga (PH-013b)

| Metric | Meaning |
|--------|---------|
| `orders_created_total` | Place-order ok/error |
| `orders_create_duration_seconds` | CreateOrder latency |
| `payments_settled_total` | confirmed / failed / error |
| `payments_confirm_duration_seconds` | Confirm latency |
| `inventory_ops_total` | reserve / deduct / release |
| `wallet_ops_total` | credit / debit |
| `idempotency_*` | Platform hit/replay (PH-011) |

Spans: `orders.CreateOrder`, `payments.Confirm`/`Fail`, `inventory.*`, `wallet.*`  
Local: `curl -s localhost:8080/metrics | grep orders_created`

Related: [[Backend API]] · [[Analytics]] · [[Runtime Topology]] · [[Money and stock rules]]

Bridge: `apps/backend/docs/observability.md` · FE `api-monitoring.md`

#ops
