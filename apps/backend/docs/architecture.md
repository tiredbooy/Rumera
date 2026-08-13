# Architecture

> **As-built (2026-08-11):** Backend **feature-architecture Phase 2 is complete**.
> Every business domain is a vertical slice under `internal/features/`. There is
> **no** `legacy.go` god-handler path, and empty layered packages
> (`internal/services`, `internal/repositories`, `internal/mappers`) are gone.
> Dual-doc process: [`docs/DOCUMENTATION-DUAL-TRACK.md`](../../../docs/DOCUMENTATION-DUAL-TRACK.md).

## Feature-based layout

Business domains live in **vertical slices** under `internal/features/<name>/`
(handler + service + repository + model + `routes.go` + `wire.go`). The main
router is a **composer** only:

```
internal/routes/routes.go     → trust groups + feature.Register*
internal/handlers/            → composition root (Deps of feature handlers + User + RBAC)
internal/features/<domain>/   → owns that domain end-to-end
internal/platform/httpx/      → shared bind / errors / params
internal/models/              → cross-feature shared types only
```

`handlers.Handler` has **no business HTTP methods** — it only holds feature
handlers for `Register*` and shared services middleware needs (`users.Service`
for Auth, `rbac.Service` for `RequirePermission`).

All storefront/admin business routes are feature-registered. Charter (history):
`refactor-workstreams/backend-feature-architecture/CHARTER.md`.

Domain → package table: [architecture/domain-map.md](./architecture/domain-map.md).  
Money & stock sagas (when present): [architecture/money-and-stock-sagas.md](./architecture/money-and-stock-sagas.md) (PH-000c).

## Layered design (within a feature)

Inside each feature, dependencies stay one-directional:

```
┌─────────────────────────────────────────────────────────┐
│  Transport         routes composer + middlewares         │
├─────────────────────────────────────────────────────────┤
│  Handlers          feature handler                       │
├─────────────────────────────────────────────────────────┤
│  Services          business rules                        │
├─────────────────────────────────────────────────────────┤
│  Repositories      SQL access                            │
├─────────────────────────────────────────────────────────┤
│  Database          PostgreSQL · TimescaleDB · Redis      │
└─────────────────────────────────────────────────────────┘
```

**Why it matters:** a handler never writes SQL, a service never touches `gin.Context`, and a repository never knows about HTTP. This keeps each layer independently testable and swappable.

## Request lifecycle

1. **Global middleware** runs in order: recovery → request-id → logger → timeout → rate-limit → gzip → analytics capture.
2. **Trust-tier routing** (see below) — public / customer / admin groups in `routes.Setup`.
3. **Feature handler** binds and validates the request (`platform/httpx`), then calls its service.
4. **Service** enforces business rules and orchestrates repositories (and cross-feature deps injected at wire time).
5. **Repository** executes SQL and returns domain models.
6. **Handler** maps domain models to response DTOs and writes the [response envelope](./conventions.md).
7. **Analytics middleware** (deferred to after the handler returns) reads the resolved identity and pushes a non-blocking event to the ingestion queue.

### Trust tiers

| Tier | Mount | Middleware | Who |
|------|--------|------------|-----|
| **Public** | `/api/v1/…` (no group auth) | optional rate limits; payment webhook uses **idempotency** middleware | anonymous storefront, OTP login, webhooks |
| **Customer** | same prefix, `Auth` group | `mw.Auth` (any live user) | account, cart, checkout, wallet read, … |
| **Admin** | `/api/v1/admin/…` | `Auth` + `RequireRole(admin\|staff)` + often `RequirePermission(…)` | CMS, inventory, orders ops, analytics |

Media transform routes may mount **outside** `/api/v1` via `media.RegisterPublicRoot`.

Webhook path is public but **HMAC-verified** and **idempotent** — see [payments-and-webhooks](./architecture/payments-and-webhooks.md).

## Dependency injection

The object graph is assembled exactly once at startup in
[`internal/bootstrap/container.go`](../internal/bootstrap/container.go).
**Feature packages own their constructors** (`features/<name>/wire.go` —
typically `New` / `Wire` / `NewRepos`) which build
repository → service → handler. Bootstrap only:

1. Initialises platform deps (JWT, mailer, SMS, validator, media storage, notifications).
2. Calls feature constructors in dependency order (wallet before loyalty, inventory before payments, order repos before payment service, …).
3. Assembles `handlers.Deps` for the routes composer.

```
features/<name>.New(…)  ──►  handlers.Deps  ──►  handlers.Handler
         │
         └────────►  analytics.Queue / cron (shared services)
```

`build()` returns a `container` holding the `*handlers.Handler`, the `token.Manager`,
the `*analytics.Queue`, and the optional cron runner. Nothing else constructs
dependencies — there are no global singletons.

## Identity model

The `users` table has **two** identifiers, and both matter:

| Column | Type | Purpose |
|--------|------|---------|
| `id` | `BIGSERIAL` (int64) | Internal foreign key — used by orders, wallet, addresses, wishlists, reviews |
| `user_id` | `UUID` | Public identifier — exposed in API responses and the URL for admin user routes |

To avoid an extra database round-trip on every authenticated request, the **JWT carries both**: `uid` (int64) and `user_id` (uuid). The [`Auth` middleware](../internal/middlewares/auth.go) puts both into the request context. See [Authentication](./authentication.md).

## Analytics pipeline

Analytics is fully decoupled from the request path:

```
request ─► Analytics middleware ─► Queue.Push (non-blocking, buffered 10k)
                                        │
                                        ▼
                              4 worker goroutines
                                        │  batch 250 / flush 3s
                                        ▼
                              EventService.FlushEvents ─► analytics DB
```

If the buffer is full, events are **dropped, never blocked** — request latency is never held hostage to analytics. Workers start before traffic is accepted and drain on graceful shutdown ([`internal/analytics/queue.go`](../internal/analytics/queue.go), wired in [`internal/bootstrap/app.go`](../internal/bootstrap/app.go)).

## Directory map

```
apps/backend/
├── cmd/
│   ├── server/            HTTP API entrypoint
│   ├── seed/              Idempotent Persian demo data
│   ├── notification-worker/  Outbox ↔ Kafka ↔ SMS/email
│   └── media-reconcile/   Orphan blob dry-run / apply
├── configs/               Environment configuration
├── deploy/kafka/          Local Redpanda compose
├── internal/
│   ├── analytics/         Async event ingestion queue
│   ├── bootstrap/         App lifecycle + DI orchestrator + router
│   ├── corn/              Cron jobs (stats, search, alerts, …)  [sic: "cron"]
│   ├── features/          Vertical slices (handler/service/repo + wire.go)
│   ├── handlers/          Composition root (Deps of feature handlers)
│   ├── middlewares/       Auth, analytics capture
│   ├── models/            Shared errors, filters, patches, product wire DTOs
│   ├── notifications/     Outbox, dispatcher, kafka/postgres adapters
│   ├── platform/httpx/    Shared bind / validate / error helpers
│   ├── routes/            Route composer (Register* only)
├── migrations/
│   ├── main/              Main DB schema
│   └── analytics/         Analytics DB schema
└── pkg/
    ├── apperr/            Typed application errors
    ├── cache/             Redis store
    ├── crypto/            Password hashing, secure tokens
    ├── database/          Connection pools, migrations
    ├── imaging/           Transform pipeline
    ├── middleware/        Generic HTTP middleware (logger, ratelimit, …)
    ├── notify/ sms/       Provider interfaces
    ├── response/          Response envelope + error codes
    ├── storage/           Blob store
    ├── token/             JWT manager
    └── validator/         Struct validation
```

Further reading:

- [Architecture index](./architecture/README.md)
- [Domain map](./architecture/domain-map.md)
- [Data stores](./architecture/data-stores.md)
- [Inventory](./architecture/inventory.md)
- [Media pipeline](./architecture/media-pipeline.md)
- [Processes & jobs](./architecture/processes-and-jobs.md)
- [Notifications / Kafka](./architecture/notifications-kafka.md)
- [Payments & webhooks](./architecture/payments-and-webhooks.md)
- [Search](./architecture/search.md)

## Design principles

- **Thin handlers.** Bind → validate → delegate → map → respond. No business logic.
- **Feature ownership.** New endpoints land in the owning feature package, not in `handlers/`.
- **Downward imports only.** Features may depend on `models`, `platform/httpx`, `pkg/*`, and other features only when bootstrap wires them; **import cycles are a hard fail** (use local interfaces at boundaries).
- **Typed errors.** Services return `*apperr.AppError` / shared sentinels; handlers map via a consistent error path. See [Conventions](./conventions.md).
- **Ownership enforced server-side.** Customer-scoped resources (orders, addresses, wishlist) are always filtered by the authenticated `uid` — a customer can never read another user's data by guessing an ID.
- **No client-trusted privilege.** Registration always forces `role=customer`; password hashes are never accepted from the client.
- **Money & stock are atomic.** Order create + reserve, payment confirm + deduct, coupon locks — same DB transaction. Never “available = on_hand” without subtracting committed. See [inventory](./architecture/inventory.md).
- **No free money.** Customer wallet credit only via paid paths / admin-gated credit with audit + idempotency — never a public “deposit free cash” endpoint.
- **Idempotency for at-least-once callers.** Payment webhook is protected today; full money-route platform design is in [idempotency.md](./architecture/idempotency.md) (PH-011a); wiring continues PH-011b…e.

## Where to look for X

| Question | Start here |
|----------|------------|
| Which package owns capability Y? | [domain-map.md](./architecture/domain-map.md) |
| How is DI ordered? | `internal/bootstrap/container.go` + each `features/*/wire.go` |
| How do routes mount? | `internal/routes/routes.go` → `feature.Register*` |
| Stock reserve / deduct? | [inventory.md](./architecture/inventory.md) |
| Payment + webhook settle? | [payments-and-webhooks.md](./architecture/payments-and-webhooks.md) |
| Idempotency / double-submit safety? | [idempotency.md](./architecture/idempotency.md) |
| Search ILIKE vs Meili? | [search.md](./architecture/search.md) — ILIKE live; Meili reindex readiness PH-030b (no cutover) |
| Loyalty earn / clawback? | [loyalty.md](./architecture/loyalty.md) (PH-040a rules) · [api/loyalty.md](./api/loyalty.md) |
| Cron / outbox / Kafka? | [processes-and-jobs.md](./architecture/processes-and-jobs.md), [notifications-kafka.md](./architecture/notifications-kafka.md) |
| Plain-language product story | [how-it-works.md](./how-it-works.md) |
| Whole monorepo picture | [`docs/SYSTEM-OVERVIEW.md`](../../../docs/SYSTEM-OVERVIEW.md) |
