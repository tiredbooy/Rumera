# Data stores

**Who this is for:** anyone deploying, debugging, or deciding where a new piece
of data should live.

**Config:** all connection settings are env-driven via `configs/config.go`
(see `.env.dev.example` / `.env.example` at the monorepo root).

---

## Overview

| Store | Role | Failure philosophy |
|-------|------|--------------------|
| **Main PostgreSQL** | System of record for commerce & content | Required at boot |
| **Analytics PostgreSQL (TimescaleDB)** | Events + rollups | Required for analytics features; API can still serve catalogue if carefully degraded — currently both pools are wired at boot |
| **Redis** | Cache, stampede locks, rate-limit helpers | Degrade cache hits; see operations guide |
| **Meilisearch** | Product search index | Search degrades if cold/down |
| **Local media disk** | Originals + transform cache | Uploads/transforms fail if disk full |
| **Kafka / Redpanda** | Notification bus (optional) | `NOTIFICATIONS_MODE=inline` works without it |

---

## Main database

- **Migrations:** `migrations/main/*.sql` (goose), applied on API boot.
- **Owns:** users, roles, catalogue (products, variants, options, images),
  categories, brands, tags, cart, addresses, shipping, coupons, orders,
  payments, inventory, recipes, blog, hero, settings, wishlist, reviews,
  wallet/loyalty/…, **notification_outbox**, **notification_deliveries**,
  idempotency keys, media ownership rows, etc.
- **Access:** `pkg/database` pool → repositories only.

Seed command (`cmd/seed`) writes **only** to the main DB.

---

## Analytics database

- **Migrations:** `migrations/analytics/*.sql`.
- **Owns:** raw event tables (hypertables where applicable), daily product
  stats, daily revenue stats, search summary, other rollups.
- **Write path:** analytics middleware resolves `sid`/`did` cookies
  (`internal/analytics` persist helpers; `Set-Cookie` before the handler)
  → in-memory queue → worker flush (`internal/analytics/queue.go`).
  **Never block** the HTTP response on insert failure beyond drop-when-full.
  Present valid UUIDs are reused; IDs are minted only when the cookie is
  missing. The store BFF must forward those cookies — it must not invent IDs.
- **Read path:** admin analytics handlers + cron jobs that aggregate into daily
  tables.

Do not join analytics tables from hot storefront product queries — keep the
boundaries clean.

---

## Redis

Used for:

- Cached responses / stampede protection (see [operations.md](../operations.md))
- Short-lived coordination

Not a source of truth. Flushing Redis must not lose orders or inventory.

---

## Meilisearch

- Flag: `MEILI_ENABLED` (default **false**). Host/key/index: `MEILI_HOST`,
  `MEILI_API_KEY`, `MEILI_INDEX_UID` (default `products`).
- Client: `pkg/meili` — fail-soft at boot when enabled but unreachable.
- Document shape: `models.MeiliProduct` (display + `*_search` normalized fields)
  via `product.ToMeiliProduct` / full rebuild from `ListForSearchIndex`.
- Cron: `meili_reindex` (`CRON_MEILI_REINDEX_SCHEDULE`) only when client connected.
- Storefront `/search` uses **main Postgres** (`rumera_search_normalize` + ILIKE,
  PH-030a) — it does **not** depend on Meili being up or warm.
- Cron `search_summary` / `search_job` is **search analytics**, not a Meili indexer.

Empty or down Meili must never 500 the storefront (ILIKE remains authority until
an explicit dual-path cutover — see [search.md](./search.md)).

---

## Media storage

- Abstraction: `pkg/storage` (local filesystem implementation today).
- Imaging: `pkg/imaging` (libvips when available, stdlib fallback).
- On-disk layout holds **originals** and a **transform cache**.
- HTTP serve: `GET /media/*` with optional `f`, `q`, `w`, `h`, `fit` query params.

See [media-pipeline.md](./media-pipeline.md).

---

## Kafka (notifications)

- Optional brokers: `KAFKA_BROKERS`.
- Used only when async notifications are enabled and a worker is running.
- Local compose: `deploy/kafka/` (Redpanda).
- Topics and envelope: [notifications-kafka.md](./notifications-kafka.md).

---

## Decision guide: where do I put X?

| Kind of data | Put it in |
|--------------|-----------|
| Order, stock, user, CMS content | Main Postgres |
| Clickstream, funnels, daily KPI rollups | Analytics DB |
| “Remember this product list for 60s” | Redis cache (optional) |
| Full-text product search | Main Postgres ILIKE + normalize today; Meili later (derived) |
| Binary image | Media storage + metadata row in main DB |
| “Send OTP eventually” | Outbox row (main) → Kafka → worker |

Derived stores (Meili, Redis, rollups) must be **rebuildable** from main +
analytics sources.
