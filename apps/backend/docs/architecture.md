# Architecture

## Layered design

The backend follows a strict, one-directional dependency flow. Each layer only knows about the layer directly beneath it.

```
┌─────────────────────────────────────────────────────────┐
│  Transport         internal/routes      route tree       │
│                    internal/middlewares  auth, analytics │
├─────────────────────────────────────────────────────────┤
│  Handlers          internal/handlers     HTTP ⇄ service  │
├─────────────────────────────────────────────────────────┤
│  Services          internal/services     business rules  │
├─────────────────────────────────────────────────────────┤
│  Repositories      internal/repositories SQL access      │
├─────────────────────────────────────────────────────────┤
│  Database          PostgreSQL · TimescaleDB · Redis      │
└─────────────────────────────────────────────────────────┘
```

**Why it matters:** a handler never writes SQL, a service never touches `gin.Context`, and a repository never knows about HTTP. This keeps each layer independently testable and swappable.

## Request lifecycle

1. **Global middleware** runs in order: recovery → request-id → logger → timeout → rate-limit → gzip → analytics capture.
2. **Routing** dispatches to a route group based on trust tier (public / customer / admin). Group middleware (`Auth`, `RequireRole`) runs here.
3. **Handler** binds and validates the request, then calls one or more services.
4. **Service** enforces business rules and orchestrates repositories.
5. **Repository** executes SQL and returns domain models.
6. **Handler** maps domain models to response DTOs and writes the [response envelope](./conventions.md).
7. **Analytics middleware** (deferred to after the handler returns) reads the resolved identity and pushes a non-blocking event to the ingestion queue.

## Dependency injection

The entire object graph is assembled exactly once, at startup, in [`internal/bootstrap/container.go`](../internal/bootstrap/container.go):

```
repositories  ──►  services  ──►  handlers.Deps  ──►  handlers.Handler
                       │
                       └────────►  analytics.Queue (EventService)
```

`build()` returns a `container` holding the `*handlers.Handler`, the `token.Manager`, and the `*analytics.Queue`. Nothing else in the codebase constructs dependencies — there are no global singletons.

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
├── cmd/server/            Entry point (main.go)
├── configs/               Environment configuration
├── internal/
│   ├── analytics/         Async event ingestion queue
│   ├── bootstrap/         App lifecycle + DI container + router
│   ├── corn/              Cron jobs (stats rollups)        [sic: "cron"]
│   ├── handlers/          HTTP handlers (this layer)
│   ├── mappers/           Domain model → response DTO mapping
│   ├── middlewares/       Auth, analytics capture
│   ├── models/            Domain models, request/response DTOs, filters
│   ├── repositories/      SQL data access
│   ├── routes/            Route tree
│   └── services/          Business logic
├── migrations/
│   ├── main/              Main DB schema
│   └── analytics/         Analytics DB schema
└── pkg/
    ├── apperr/            Typed application errors
    ├── cache/             Redis store
    ├── crypto/            Password hashing, secure tokens
    ├── database/          Connection pools, migrations
    ├── middleware/        Generic HTTP middleware (logger, ratelimit, …)
    ├── response/          Response envelope + error codes
    ├── token/             JWT manager
    └── validator/         Struct validation
```

## Design principles

- **Thin handlers.** Bind → validate → delegate → map → respond. No business logic.
- **Typed errors.** Services return `*apperr.AppError`; the response layer maps them to HTTP status + stable error codes. See [Conventions](./conventions.md).
- **Ownership enforced server-side.** Customer-scoped resources (orders, addresses, wishlist) are always filtered by the authenticated `uid` — a customer can never read another user's data by guessing an ID.
- **No client-trusted privilege.** Registration always forces `role=customer`; password hashes are never accepted from the client.
