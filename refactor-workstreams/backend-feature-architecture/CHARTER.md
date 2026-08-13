# Backend Feature Architecture Charter

**Workstream:** `backend-feature-architecture-20260810`
**Status:** Locked
**Date:** 2026-08-10
**Updated:** 2026-08-10 (decisions confirmed)

## Problem

The backend is organised by **technical layer** (all handlers together, all
services together, all repositories together). At ~220 routes that makes
ownership hard: every change spans four+ directories and one god composition
root. Future readers should open one feature folder and understand that domain.

## Goal

Reorganise into **feature-based vertical slices** so each business capability
lives under one package tree, while **HTTP behaviour and JSON contracts stay
identical**.

## Locked decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Catalog packaging | **Umbrella** `features/catalog/{product,variant,option,category,brand,tag}` | Catalogue domains are tightly coupled (products need categories, brands, tags, variants). One boundary prevents import-cycle sprawl and gives a single place to look for “shop catalogue”. |
| Account packaging | **Flat** sibling packages: `wallet`, `wishlist`, `loyalty`, `referral`, `giftcard`, `subscription`, `alerts`, `taste` | These domains are loosely coupled. An “account” umbrella becomes a junk drawer; flat packages stay independently testable and scalable. |
| Handler style | **Each feature owns** `Handler` + `RegisterPublic` / `RegisterCustomer` / `RegisterAdmin` | Routes become a thin composer. New endpoints land next to the feature, not in a god file. |
| Migration order | **rbac → users → auth → addresses → flat account → content → commerce → media → catalog → analytics → composition cleanup** | Lowest blast radius first; learn the pattern before moving the hub (catalog/orders). |

## Non-goals

- No microservices
- No API path/JSON contract changes
- No “fix product bugs while moving” unless they block compile/test
- No frontend rewrites in this workstream

## Target shape

```
apps/backend/internal/
  platform/
    httpx/                 # shared bind/validate/error helpers
    # bootstrap stays in internal/bootstrap until BE-042
  features/
    rbac/
    users/
    auth/
    addresses/
    wallet/
    wishlist/
    loyalty/
    referral/
    giftcard/
    subscription/
    alerts/
    taste/
    site_settings/
    hero/
    blog/
    recipes/
    reviews/
    recommendations/
    coupons/
    shipping/
    inventory/
    cart/
    payments/
    orders/
    media/
    catalog/
      product/
      variant/
      option/
      category/
      brand/
      tag/
    analytics/             # HTTP + stats services; capture queue may stay nearby
  routes/                  # composer only (after BE-040)
  middlewares/             # cross-cutting auth (or platform later)
  bootstrap/               # composition root
  notifications/           # already a vertical slice — leave as-is
  analytics/               # capture queue (may merge under features/analytics later)
```

### Per-feature package contract

```
features/<name>/
  doc.go              # package purpose + ownership (required)
  handler.go          # HTTP methods
  service.go          # business rules
  repository.go       # SQL
  model.go            # domain + request/response owned here
  mapper.go           # optional DTO projection
  routes.go           # RegisterPublic / RegisterCustomer / RegisterAdmin
  *_test.go
```

### Route composition (one main router)

```
internal/routes/routes.go     ← ONLY composition: trust groups + Register* calls
internal/routes/legacy.go     ← temporary home for not-yet-migrated domains
features/<name>/routes.go     ← owns that domain's paths
```

Main `Setup` never lists individual business paths for migrated features.
When you migrate domain X: add `x.RegisterAdmin(admin, h.X)` in routes.go and
delete X's block from legacy.go.

Shared libraries stay in `pkg/` (token, response, database, cache, crypto, …).
Migrations stay global under `migrations/`.

### Cross-feature rules

1. Prefer **downward** deps (orders → inventory, cart → catalog/product).
2. **No import cycles.** If two features need each other, extract a small
   interface or shared types package at the consumer boundary.
3. Features must **not** import `internal/handlers` after they migrate.
4. Temporary re-exports only with a same-epic removal task.

## Migration strategy (strangler)

For each feature task:

1. Create `internal/features/<name>/` (or catalog subpackage).
2. `git mv` files when possible; fix imports.
3. Wire feature constructor in bootstrap; attach routes via feature registrar
   when the feature is ready (early features may still hang off the god
   Handler until their methods move cleanly).
4. `go build ./...` + scoped tests green before the next feature.
5. Append `FINISHED.md`.

## Success criteria

- Open `internal/features/<domain>` and understand that domain end-to-end.
- `docs/architecture/domain-map.md` points at feature packages.
- Full test gate green.
- Storefront and admin clients need **zero** contract changes.

## How to read this repo after the refactor

1. Find the business word (users, cart, product) under `internal/features/`.
2. Read `doc.go` → `routes.go` → `handler.go` → `service.go` → `repository.go`.
3. Shared HTTP envelope/errors: `pkg/response`, `pkg/apperr`.
4. Composition: `internal/bootstrap` + `internal/routes`.
