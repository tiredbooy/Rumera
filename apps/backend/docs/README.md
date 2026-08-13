# Rumera Backend — Documentation

Production e-commerce API: **Go** (Gin + pgx + PostgreSQL / TimescaleDB + Redis).

---

## How this folder is organized

```
apps/backend/docs/
├── README.md              ← this hub
├── how-it-works.md        ← plain-language overview
├── getting-started.md     ← run locally, env, migrations
├── architecture.md        ← layers, DI, request lifecycle
├── conventions.md         ← envelope, errors, pagination
├── authentication.md      ← JWT, roles
├── operations.md          ← cache, health, hardening
├── observability.md       ← metrics, tracing, Grafana
├── architecture/          ← deep-dives (inventory, payments, …)
│   └── README.md
├── api/                   ← per-resource HTTP reference
│   └── README.md
├── guides/                ← short operational notes (.txt)
└── deploy/ (under apps/backend/deploy/)  ← Kafka compose, etc.
```

| Looking for… | Go to… |
|--------------|--------|
| Endpoint fields / status codes | [`api/`](./api/README.md) |
| Stock model & order reserve/deduct | [`architecture/inventory.md`](./architecture/inventory.md) |
| Payment webhook | [`architecture/payments-and-webhooks.md`](./architecture/payments-and-webhooks.md) |
| Which binary or cron | [`architecture/processes-and-jobs.md`](./architecture/processes-and-jobs.md) |
| All architecture guides | [`architecture/README.md`](./architecture/README.md) |

---

## Core guides

| Guide | What it covers |
|-------|----------------|
| [How it works](./how-it-works.md) | Non-technical system story |
| [Getting started](./getting-started.md) | Prerequisites, env, migrations, Docker |
| [Architecture](./architecture.md) | Layered design, request lifecycle, DI |
| [Conventions](./conventions.md) | Response envelope, errors, pagination, validation |
| [Authentication](./authentication.md) | JWT, roles, trust tiers |
| [Operations](./operations.md) | Caching, health, shutdown, hardening |
| [Observability](./observability.md) | Prometheus, OpenTelemetry, Grafana stack |
| [API reference](./api/README.md) | Every endpoint by resource |

---

## Architecture deep-dives

| Guide | What it covers |
|-------|----------------|
| [Architecture index](./architecture/README.md) | Folder map + “read by task” |
| [Domain map](./architecture/domain-map.md) | Capability → handler/service packages |
| [Data stores](./architecture/data-stores.md) | Main DB, analytics, Redis, Meili, Kafka, media |
| [Inventory](./architecture/inventory.md) | on-hand / committed / available; reserve → release → deduct |
| [Payments & webhooks](./architecture/payments-and-webhooks.md) | Order pay flow + HMAC settlement |
| [Media pipeline](./architecture/media-pipeline.md) | Upload, ownership, transform, reconcile |
| [Search](./architecture/search.md) | Persian ILIKE (PH-030a) + Meili readiness/reindex (PH-030b, no cutover) + analytics |
| [Loyalty](./architecture/loyalty.md) | Cellar Club earn/redeem rules (PH-040a) · [api](./api/loyalty.md) |
| [Processes & jobs](./architecture/processes-and-jobs.md) | server, seed, notification-worker, cron |
| [Notifications (Kafka)](./architecture/notifications-kafka.md) | Outbox, topics, worker modes |

---

## Cross-repo

| Guide | What it covers |
|-------|----------------|
| [Docs hub](../../../docs/README.md) | Monorepo documentation entry |
| [System overview](../../../docs/SYSTEM-OVERVIEW.md) | Full-stack topology |
| [Documentation map](../../../docs/DOCUMENTATION-MAP.md) | Coverage + residual gaps |
| [Testing](../../../docs/TESTING.md) | `go test`, integration suite |
| [Frontend docs](../../frontend/docs/README.md) | Next.js storefront + admin |

---

## Quick links

- **Base URL:** `http://localhost:8080`
- **API prefix:** `/api/v1`
- **Health:** `GET /health`
- **Auth:** `Authorization: Bearer <access_token>`

## 30-second tour

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

Handlers stay thin. Business logic lives in feature services under
`internal/features/<name>/`. See [Architecture](./architecture.md) for the
full picture.
