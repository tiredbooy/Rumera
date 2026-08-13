---
tags:
  - architecture
  - backend
aliases:
  - Feature backend
  - Vertical slices
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 02 Architecture]]


# Layered Backend

**Status (2026-08-11):** Feature-architecture **Phase 2 complete**.  
No `legacy.go`. No empty `internal/services` / `repositories` / `mappers`.

## As-built

Vertical slices under `internal/features/<domain>/`:

```text
routes (composer) → features/<name>/{routes,handler,service,repository,model,wire}
pkg/*  ·  platform/httpx  ·  models (shared only)
handlers/  → composition root (Deps only)
bootstrap/ → orders constructors, builds Deps
```

Within a feature, layers still apply:

- **Handler** — bind HTTP only (via `platform/httpx`), no SQL
- **Service** — business rules, no `gin.Context`
- **Repository** — SQL only
- **Models** — domain + request/response owned by the feature when possible

**Shared `internal/models` (PH-012a):** only cross-feature primitives and cycle-
avoiding catalogue/payment types. Do not grow it into a second domain layer.
See [[Wire contracts]] · [[Backend package map]] · repo `conventions.md`.

Main router: `internal/routes/routes.go` only calls  
`RegisterPublic` / `RegisterCustomer` / `RegisterAdmin`.

Decision: [[ADR Backend feature packages]]

## Trust tiers

| Tier | Gate |
|------|------|
| Public | no JWT (webhook = HMAC + idempotency) |
| Customer | `mw.Auth` |
| Admin | Auth + role + often [[RBAC]] permission |

## Catalogue vs account packaging

| Group | Layout |
|-------|--------|
| Catalogue | `features/catalog/{product,variant,option,category,brand,tag}` |
| Account / growth | flat: wallet, loyalty, giftcard, subscription, referral, … |
| Commerce core | cart, orders, payments, inventory, shipping, coupons |

## Feature list (all mounted as features)

Users · Auth · RBAC · Addresses · Wishlist · Wallet · Taste · Alerts ·  
Subscription · Gift card · Referral · Loyalty · Site settings · Hero · Blog ·  
Recipes · Reviews · Recommendations · Coupons · Shipping · Inventory · Cart ·  
Payments · Orders · Media · Analytics · full catalogue/*

Still **outside** features by design: `internal/analytics` queue, `internal/corn`
jobs, `internal/notifications`, middlewares, bootstrap.

Related: [[Backend API]] · [[Backend Domain Map]] · [[Backend package map]] ·  
[[Auth and Sessions]] · [[Money and stock rules]] · [[Pitfalls and anti-patterns]] ·  
[[Request Paths]] · [[Runtime Topology]]

Bridge: `apps/backend/docs/architecture.md` · `apps/backend/docs/architecture/domain-map.md`

#architecture #backend
