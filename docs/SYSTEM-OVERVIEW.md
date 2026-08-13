# Rumera — system overview

**Who this is for:** anyone who needs to understand the whole product before
opening a single package. After this page you should know *what runs*, *how a
request moves*, and *where each concern lives*.

For Docker-only ops see [`DOCKER.md`](./DOCKER.md). For the organized doc index
see [`docs/README.md`](./README.md). Per-app depth:
[`apps/backend/docs/`](../apps/backend/docs/) (`architecture/` deep-dives) and
[`apps/frontend/docs/`](../apps/frontend/docs/) (`platform/` + `features/`).

---

## What Rumera is

Rumera is a **Persian (Farsi, RTL) luxury wine / champagne / spirits** e-commerce
platform:

- **Public storefront** — catalogue, recipes, journal, cart, checkout
- **Customer account** — orders, addresses, wallet, wishlist, loyalty, …
- **Staff admin** — catalogue CMS, inventory, orders, analytics, monitoring
- **Go API** — source of truth for business rules, money, inventory, media

There is **no shared TypeScript/Go package workspace**. The frontend talks to
the backend over HTTP (directly on the server for public RSC reads; through
Next.js BFF proxies for authenticated browser traffic).

### Backend shape (as-built)

The Go API uses **feature vertical slices** under `apps/backend/internal/features/*`
(catalogue umbrella + flat account domains). `internal/routes` only composes
trust tiers and calls `Register*`. Composition root: `internal/handlers` (Deps)
+ `internal/bootstrap/container.go`. Depth:
[`apps/backend/docs/architecture.md`](../apps/backend/docs/architecture.md) ·
[`domain-map.md`](../apps/backend/docs/architecture/domain-map.md).

**Docs process:** [DOCUMENTATION-DUAL-TRACK.md](./DOCUMENTATION-DUAL-TRACK.md)
(project docs + Obsidian brain).

---

## Runtime topology

```
                     ┌─────────────── rumera_network ────────────────┐
 browser ──► nginx (:80)                                             │
                │                                                    │
                ├─ /*            → frontend :3000  (Next.js)         │
                │                     │                              │
                │                     ├─ public RSC → API_URL        │
                │                     └─ /api/{public,store,admin}/* │
                │                              BFF → backend         │
                │                                                    │
                └─ /api/v1/*     → backend  :8080  (Gin)             │
                                      │                              │
                     ┌────────────────┼────────────────┐             │
                     ▼                ▼                ▼             │
                 postgres         analytics_db       redis           │
                 (main)           (TimescaleDB)      (cache)         │
                     │                ▲                              │
                     │                │  async event queue           │
                     ▼                │                              │
              local media disk    Meilisearch (search index)         │
                     │                                               │
              notification-worker ──► Kafka / Redpanda (optional)    │
                     └──────────────► SMS / email providers          │
└────────────────────────────────────────────────────────────────────┘
```

| Process | Role |
|---------|------|
| `cmd/server` | HTTP API, analytics workers, in-process cron |
| `cmd/notification-worker` | Outbox → Kafka → SMS/email (async mode) |
| `cmd/seed` | Idempotent Persian demo data (main DB only) |
| `cmd/media-reconcile` | Dry-run / apply orphan media cleanup |
| Next.js | Storefront + admin UI + BFF + Auth.js |

See backend
[`processes-and-jobs.md`](../apps/backend/docs/architecture/processes-and-jobs.md).

---

## Request paths (the three doors)

### 1. Public storefront (mostly server-rendered)

```
Browser GET /products/some-slug
  → Next.js Server Component
  → features/catalog/products/api/public.ts
  → publicRequest() → ${API_URL}/api/v1/products/:slug
  → Go handler → service → repository → Postgres
  → HTML (+ optional JSON-LD) back to browser
```

No customer token. Cached with Next.js tags (`lib/cache-tags.ts`).

### 2. Authenticated customer / staff (browser)

```
Browser (client island)
  → storeRequest() or admin client
  → same-origin /api/store/* or /api/admin/*
  → Next BFF (Auth.js session → Bearer JWT)
  → ${API_URL}/api/v1/...
  → Go Auth middleware + optional RequireRole
```

The **access token never lives in browser JS**. Refresh rotation is handled in
Auth.js route responses. See frontend
[`platform/bff-and-auth.md`](../apps/frontend/docs/platform/bff-and-auth.md).

### 3. Direct API clients (mobile, scripts, integration tests)

```
Client → Authorization: Bearer <access> → /api/v1/*
```

Same backend contracts as the BFF path.

---

## Backend layering (always)

```
routes → middlewares → handlers → services → repositories → DB / Redis / storage
                         ↓
                      mappers (domain → JSON DTOs)
```

- Handlers bind HTTP and call services — **no SQL**.
- Services own business rules — **no `gin.Context`**.
- Repositories own SQL — **no HTTP**.
- Errors are `*apperr.AppError` mapped to a stable envelope.

Full story: [`architecture.md`](../apps/backend/docs/architecture.md),
[`conventions.md`](../apps/backend/docs/conventions.md).

---

## Frontend layering (always)

```
app/<route>/page.tsx          thin route (metadata + one view)
  → features/<domain>/...     domain UI, API, types, validations
  → lib/api, lib/auth, lib/rbac, lib/media, lib/seo
  → components/ui + components/brand  shared primitives only
```

Domains **own** their wire types and public/admin APIs. Do not invent a
catch-all `lib/catalog` again — that was deleted on purpose during the domain
refactor.

Domain map: [`features/domain-map.md`](../apps/frontend/docs/features/domain-map.md).

---

## Data stores (what lives where)

| Store | Contents |
|-------|----------|
| **Main Postgres** | Users, catalogue, cart, orders, media metadata, outbox, inventory, content |
| **Analytics Postgres (Timescale)** | Event stream, daily stats, search summary |
| **Redis** | Response/cache stamps, rate limits, short-lived coordination |
| **Meilisearch** | Product search documents (indexed by cron) |
| **Disk / object storage** | Original images + transform cache |
| **Kafka (optional)** | Notification events between outbox relay and delivery workers |

Details: [`data-stores.md`](../apps/backend/docs/architecture/data-stores.md).

---

## Money, catalogue, and truthfulness

- Prices are **Toman**, stored and transferred as decimals/strings per backend
  contract — display with `formatPrice()` / `faNum()` on the frontend.
- Catalogue availability is derived from **active variants + stock**, not from
  inventing UI flags. Zero price and OOS states must stay honest
  (`catalogue-presentation.ts`, recipe `commerce.ts`).
- Shipping quotes and checkout totals come from the **API**, not client math.

---

## Media in one paragraph

Admin uploads land in backend storage with **owner-scoped keys**. The API
serves `/media/{key}?f=webp&w=…` transforms. The database stores **origin-
independent** paths (`/media/...` or external https). The frontend joins a
configured media/API origin in **one place**:
`lib/media/resolve-media-url.ts`. Production configured origins must be `https`.

Both sides documented:

- Backend: [`media-pipeline.md`](../apps/backend/docs/architecture/media-pipeline.md)
- Frontend: [`features/media-and-cache.md`](../apps/frontend/docs/features/media-and-cache.md)

---

## Notifications in one paragraph

HTTP handlers call a **Dispatcher** (`NOTIFICATIONS_MODE=inline|async`). Async
mode writes a row to `notification_outbox` (same DB transaction as the domain
change when possible). A worker relays outbox → Kafka and consumers deliver
SMS/email with an idempotent delivery ledger. Architecture:
[`notifications-kafka.md`](../apps/backend/docs/architecture/notifications-kafka.md).

---

## Security model (short)

| Layer | Job |
|-------|-----|
| Edge middleware (Next) | Coarse bounce for `/account`, `/admin` |
| Layout server guards | Authoritative session + staff check |
| RBAC (`lib/rbac`) | Hide nav / disable UI |
| Backend JWT + roles | **Real** authorization |
| Customer resources | Always scoped by authenticated `uid` |

Never trust the client for role, price, stock, or ownership.

---

## Local development (30 seconds)

```bash
# repo root
make env    # once
make dev    # Docker Compose Watch: API + FE + DBs + redis + meili + nginx
make seed   # optional Persian fixtures
```

- Storefront: http://localhost:3000 (or via gateway :80)
- API: http://localhost:8080 · health `GET /health`
- Env templates: `.env.dev.example`, `.env.example`, app-level frontend env

---

## Where to go next

| If you are building… | Read |
|----------------------|------|
| Doc index | [`docs/README.md`](./README.md) |
| A new public page | [FE platform/architecture](../apps/frontend/docs/platform/architecture.md) + [domain-map](../apps/frontend/docs/features/domain-map.md) |
| Login / session | [bff-and-auth](../apps/frontend/docs/platform/bff-and-auth.md) + BE authentication |
| Admin module | [admin-console](../apps/frontend/docs/features/admin-console.md) + [rbac](../apps/frontend/docs/platform/rbac.md) |
| Catalogue / cart / checkout | [storefront-commerce](../apps/frontend/docs/features/storefront-commerce.md) |
| Inventory / stock | BE [inventory](../apps/backend/docs/architecture/inventory.md) + FE [inventory](../apps/frontend/docs/features/inventory.md) |
| Payments / webhooks | BE [payments-and-webhooks](../apps/backend/docs/architecture/payments-and-webhooks.md) |
| Customer account | FE [account-tour](../apps/frontend/docs/features/account-tour.md) |
| Search | BE [search](../apps/backend/docs/architecture/search.md) + FE [search](../apps/frontend/docs/features/search.md) |
| Upload or display images | [media-pipeline](../apps/backend/docs/architecture/media-pipeline.md) + [media-and-cache](../apps/frontend/docs/features/media-and-cache.md) |
| Async SMS/email | notifications-kafka + processes-and-jobs |
| Metrics / Grafana | BE observability + FE api-monitoring |
| Tests | [`TESTING.md`](./TESTING.md) |
| “Is this documented?” | [`DOCUMENTATION-MAP.md`](./DOCUMENTATION-MAP.md) |
