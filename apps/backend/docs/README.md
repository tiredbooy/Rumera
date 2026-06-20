# Rumera Backend — Documentation

A production-grade e-commerce backend written in Go (Gin + pgx + PostgreSQL/TimescaleDB + Redis).

This is the documentation home. Start here, then follow the links below.

## Contents

| Guide | What it covers |
|-------|----------------|
| [How It Works (plain-language)](./how-it-works.md) | **Non-technical overview** — the whole system explained with everyday analogies, for anyone |
| [Getting Started](./getting-started.md) | Prerequisites, environment, migrations, running locally and with Docker |
| [Architecture](./architecture.md) | Layered design, request lifecycle, directory map |
| [Conventions](./conventions.md) | Response envelope, error model, pagination, filtering, validation |
| [Authentication & Authorization](./authentication.md) | JWT flow, token contents, roles, trust tiers |
| [Operations, Performance & Reliability](./operations.md) | Caching & stampede protection, cron jobs, health probes, graceful shutdown, server hardening |
| [Observability](./observability.md) | Prometheus metrics, OpenTelemetry tracing, health/readiness probes, and the Prometheus + Grafana stack |
| [API Reference](./api/README.md) | Every endpoint, grouped by resource |

## Quick links

- **Base URL:** `http://localhost:8080`
- **API prefix:** `/api/v1`
- **Health check:** `GET /health`
- **Auth:** `Authorization: Bearer <access_token>`

## The 30-second tour

```
HTTP request
   │
   ▼
middleware  ──►  recovery · request-id · logger · timeout · rate-limit · gzip · analytics
   │
   ▼
route group ──►  public │ customer (Auth) │ admin (Auth + RequireRole)
   │
   ▼
handler     ──►  bind → validate → call service → map to DTO → respond
   │
   ▼
service     ──►  business rules, validation, orchestration
   │
   ▼
repository  ──►  SQL against PostgreSQL / TimescaleDB
```

Handlers are deliberately thin. All business logic lives in [`internal/services`](../internal/services); handlers only translate HTTP ⇄ service calls. See [Architecture](./architecture.md) for the full picture.
