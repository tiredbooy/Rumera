# Finished Backend Feature-Architecture Tasks

**Workstream ID:** `backend-feature-architecture-20260810`

Completed tasks are appended here only after verification. This history is
append-only.

## Workstream opened

**Status:** Complete (tracker only)
**Date:** 2026-08-10

### What Changed

- Created workstream directory and ordered backlog for a non-breaking move from
  layered Go packages to feature-based vertical slices.
- Baseline notes recorded: god `Handler`/`Deps`, central `routes.go`, partial
  vertical slices already exist for notifications and analytics capture.

## Task BE-000 - Architecture charter (locked)

**Status:** Complete
**Date:** 2026-08-10

### Decisions

- Catalog: umbrella `features/catalog/{product,variant,option,category,brand,tag}`
- Account: flat packages (`wallet`, `wishlist`, …)
- Each feature owns Handler + RegisterPublic/Customer/Admin
- Order: rbac → users → auth → …

### Files

- `CHARTER.md`, `TASKS.md`

---

## Task BE-001 - Green baseline

**Status:** Complete
**Date:** 2026-08-10

### What Changed

- Fixed `TestUserServiceAdminRolesAreDeterministic` for staff role in
  `AssignableUserRoles`.

### Verification

```text
go test ./internal/... ./pkg/...  → green
go build ./... → green
```

---

## Task BE-002 - Feature skeleton

**Status:** Complete
**Date:** 2026-08-10

### What Changed

- Created `internal/features/**/doc.go` for all planned domains + catalog
  subpackages.
- Created `internal/platform/httpx` package placeholder.

### Verification

```text
go build ./internal/features/... ./internal/platform/... → green
```

---

## Task BE-003 - platform/httpx helpers

**Status:** Complete
**Date:** 2026-08-10

### What Changed

- Moved bind/validate/params/identity/query/error/pagination helpers to
  `internal/platform/httpx`.
- `handlers/common.go` is thin wrappers for legacy handlers (no behaviour change).

### Verification

```text
go build ./... → green
go test ./internal/handlers ./internal/routes ./internal/services → green
```

---

## Task BE-010 - Migrate rbac

**Status:** Complete
**Date:** 2026-08-10

### What Changed

- Vertical slice at `internal/features/rbac/`:
  model, repository, service, handler, routes, tests.
- Removed layered files:
  `models/capability.go`, `repositories/capability_repo.go`,
  `services/capability_svc.go`.
- Feature owns GET/PUT capability routes via `RegisterAdmin` (not yet mounted
  in live router — product RBAC rollout is separate; package is ready).

### Verification

```text
go test ./internal/features/rbac -v → 4 tests PASS
go test ./internal/... ./pkg/... → green
go build ./... → green
```

### How to read

`internal/features/rbac/doc.go` → routes → handler → service → repository.


## Task BE-011 - Migrate users

**Status:** Complete
**Date:** 2026-08-10

### What Changed

- Full vertical slice at `internal/features/users/`:
  - `model.go` — User, AuthUser, admin DTOs, role constants
  - `repository.go` — users table + admin audit
  - `service.go` + tests — registration, admin self-lockout, roles summary
  - `mapper.go` — response projection
  - `handler.go` + `routes.go` — own Handler + RegisterAdmin / RegisterCustomer
- Removed layered originals: `models/user.go`, `repositories/user_repo.go`,
  `services/user_svc.go`, `handlers/user.go`, `mappers/user_mappers.go`
- Wired bootstrap, routes, middleware `AuthUserReader`, password-reset, seed,
  auth handlers.
- Shared filter types (`BaseFilter`, `NullablePatch`) remain in `models` as
  cross-feature infrastructure.
- Broke `httpx → middlewares` import (httpx reads gin context keys) so
  features can use httpx without cycles.

### How to read

```
internal/features/users/doc.go
  → routes.go → handler.go → service.go → repository.go → model.go
```

### Verification

```text
go build ./... → green
go test ./internal/... ./pkg/... → green
  including features/users, routes smoke, middlewares, services
```

### API contract

Unchanged paths and JSON:
- PATCH /auth/me
- GET/POST /admin/users, GET/PATCH/DELETE /admin/users/:userID
- GET /admin/users/:userID/audit
- GET /admin/roles


## Task BE-012 - Migrate auth

**Status:** Complete
**Date:** 2026-08-10

### What Changed

- Full vertical slice at `internal/features/auth/`:
  - login, register, refresh, logout, OTP, /me
  - password reset model/repo/service/handler
  - token whitelist rotation (tokens.go + tests)
  - own `Handler` + `RegisterPublic` / `RegisterCustomer`
- Removed layered originals under handlers/services/repositories/models for auth
  and password reset.
- Bootstrap wires `auth.Handler` with users service + loyalty award hook +
  password-reset session killer.
- Routes compose auth feature (no god-handler auth methods).

### How to read

```
internal/features/auth/doc.go
  → routes.go → handler.go → tokens.go → otp.go → password_reset_*
```

### Verification

```text
go build ./... → green
go test ./internal/... ./pkg/... → green
  including features/auth token rotation tests, routes smoke
```

### API contract

Unchanged auth paths and JSON payloads.


## Task BE-013 - Migrate addresses

**Status:** Complete
**Date:** 2026-08-10

### What Changed

- Full vertical slice at `internal/features/addresses/`:
  model, repository, service (+ tests), handler, routes (`RegisterCustomer`).
- Wired bootstrap + `handlers.Deps` (`Address` service + `Addresses` handler).
- Main composer calls `addresses.RegisterCustomer`; removed block from `legacy.go`.
- Order service address lookup now uses `*addresses.Address` (downward dep).
- Removed layered originals: handlers/services/repositories/models address files.

### How to read

```
internal/features/addresses/doc.go
  → routes.go → handler.go → service.go → repository.go → model.go
```

### Verification

```text
go build ./... → green
go test ./internal/... ./pkg/... → green
  including features/addresses, routes smoke, order service tests
```

### API contract

Unchanged customer address paths and JSON.

### Documentation

- Obsidian: ADR Backend feature packages, Addresses Backend, package/domain maps,
  Layered Backend, Connect 03/11
- Docs: domain-map.md, api/addresses.md ownership note
- Workstream FINISHED.md (this record)


## Task BE-014 - Migrate wishlist

**Status:** Complete
**Date:** 2026-08-10

### What Changed

- Full vertical slice at `internal/features/wishlist/`:
  model, repository, service (+ tests), mapper, handler, routes.
- Wired bootstrap + `handlers.Deps` (`Wishlist` service + `Wishlists` handler).
- Composer: `wishlist.RegisterCustomer`; removed block from `legacy.go`.
- Integration inventory test imports updated to feature package.
- Removed layered originals (handler/service/repo/model/mapper).

### How to read

```
internal/features/wishlist/doc.go
  → routes.go → handler.go → service.go → repository.go → model.go
```

### Verification

```text
go build ./... → green
go test ./internal/... ./pkg/... → green
  including features/wishlist, routes smoke
```

### API contract

Unchanged customer wishlist paths and JSON.

### Documentation

- Obsidian: Wishlist Backend, maps, ADR migrated list, Account Domain, Connect 03
- Docs: domain-map.md, architecture.md, api/wishlist.md
- Workstream FINISHED.md (this record)


## Task BE-015 - Migrate wallet

**Status:** Complete
**Date:** 2026-08-10

### What Changed

- Full vertical slice at `internal/features/wallet/`:
  model, repository, service (+ tests with local stubs), mapper, handler, routes.
- Customer routes: get wallet, transactions, withdraw→410.
- Admin route: `POST /admin/users/:userID/wallet/credit` via `RegisterAdmin`
  (uses `users.Service` for UUID→internal id).
- Loyalty + gift-card constructors take `*wallet.Service`.
- Mocks `WalletRepo` implements `wallet.Repository`.
- Removed layered wallet handler/service/repo/model/mappers.
- Service tests use local stubs (no `mocks` import — avoids cycle).

### How to read

```
internal/features/wallet/doc.go
  → routes.go → handler.go → service.go → repository.go → model.go
```

### Verification

```text
go build ./... → green
go test ./internal/... ./pkg/... → green
  including features/wallet (4 service tests), routes, services/loyalty
```

### API contract

Unchanged wallet + admin credit paths/JSON. Withdraw remains 410 Gone.

### Documentation

- Obsidian: Wallet Backend + maps/ADR/Account Domain/Connect 03
- Docs: domain-map, architecture.md, api/wallet.md
- Workstream FINISHED.md


## Task BE-016 - Flat account domains

**Status:** Complete
**Date:** 2026-08-10

### What Changed

Migrated six flat account packages under `internal/features/`:

| Package | Routes |
|---------|--------|
| `loyalty` | GET/POST loyalty* |
| `referral` | GET /referrals/me, POST claim |
| `giftcard` | POST redeem + admin issue |
| `subscription` | CRUD cellar box |
| `alerts` | product restock/price alerts |
| `taste` | GET/PUT /me/taste-profile |

Also:

- Payment service uses `*loyalty.Service` + `*referral.Service`
- Cron jobs use `alerts.Repository` + `subscription.Repository`
- Auth still uses `LoyaltyAwarder` interface (satisfied by loyalty.Service)
- Composer + legacy.go updated; layered account files removed

### Verification

```text
go build ./... → green
go test ./internal/... ./pkg/... → green
  all new features + routes + services + corn wiring
```

### Documentation

- Obsidian: per-domain backend notes, maps, ADR, Account Domain, Connect 03
- Docs: domain-map.md, architecture.md, API ownership where files exist
- Workstream FINISHED.md


## Task BE-017 - Migrate site_settings

**Status:** Complete
**Date:** 2026-08-10

### What Changed

- Vertical slice at `internal/features/site_settings/`:
  model, repository, service, mapper, handler (with Redis cache + singleflight),
  routes, model tests.
- Public: `GET /settings` via `RegisterPublic`
- Admin: `GET|PUT /admin/settings` via `RegisterAdmin`
- Cache invalidation on admin update preserved.
- Removed layered site_settings files; legacy routes cleaned.

### Verification

```text
go build ./... → green
go test ./internal/... ./pkg/... → green
  including features/site_settings
```

### Documentation

- Obsidian: Site Settings Backend + maps/ADR/Connect 03
- Docs: domain-map, architecture.md, api/site-settings.md
- Workstream FINISHED.md


## Task BE-018 - Migrate hero

**Status:** Complete
**Date:** 2026-08-10

### What Changed

- Vertical slice at `internal/features/hero/`:
  model (+ patch tests), repository, service (+ validation + tests),
  media URL helpers (local copies until media feature migrates),
  mapper, handler, routes.
- `MediaCleaner` interface for image cleanup (satisfied by MediaLifecycleService).
- Public + admin routes composed; legacy blocks removed.
- Seed + integration tests updated to `hero` package.
- models media_patch_test no longer depends on HeroSlideUpdateReq type.

### Verification

```text
go build ./... → green
go test ./internal/... ./pkg/... → green
```

### Documentation

- Obsidian: Hero Slides Backend + maps/ADR/Connect 03/Hero and Home
- Docs: domain-map, architecture.md, api hero-slides if present
- Workstream FINISHED.md


## Task BE-019 - Migrate blog

**Status:** Complete
**Date:** 2026-08-10

### What Changed

- Vertical slice at `internal/features/blog/`:
  posts + categories (model, repository, service, mapper, handler, routes),
  media helpers, service tests.
- `MediaCleaner` for image cleanup; `pgxBeginner` restored in `services` for cart/recipe.
- Composer: `blog.RegisterPublic` + `RegisterAdmin`.
- Seed + integration tests updated.
- models media_patch_test decoupled from BlogUpdateReq.

### Verification

```text
go build ./... → green
go test ./internal/... ./pkg/... → green
```

### Documentation

- Obsidian: Blog Backend + maps/ADR/Connect 03/Recipes and Journal
- Docs: domain-map, architecture.md, api/blog.md
- Workstream FINISHED.md


## Task BE-020 - Migrate recipes

**Status:** Complete
**Date:** 2026-08-10

### What Changed

- Vertical slice at `internal/features/recipes/`:
  model, repository, service, mapper (+ tests), media helpers,
  handler (local cache/singleflight for public detail), routes.
- `MediaCleaner` for image cleanup; public slug cache TTL 120s with write bust.
- Composer: `recipes.RegisterPublic` + `RegisterAdmin`; legacy recipe routes removed.
- Seed + integration tests (`content_storefront`, `media`) updated to `recipes` package.
- models media_patch_test decoupled from `RecipeUpdateReq`.
- Deleted layered `handlers/recipe.go`, `services/recipe_svc.go`,
  `repositories/recipe_repo.go`, `models/recipes.go`, `mappers/recipe_mappers*`.

### Verification

```text
go build ./... → green
go test ./internal/... ./pkg/... → green
  including features/recipes
```

### Documentation

- Obsidian: Recipes Backend + maps/ADR/Connect 03/Recipes and Journal
- Docs: domain-map, architecture.md, api/recipes.md
- Workstream FINISHED.md

## Task BE-021 - Migrate reviews

**Status:** Complete
**Date:** 2026-08-10

### What Changed

- Vertical slice at `internal/features/reviews/`:
  model, repository, image_repository, service (+ tests), mapper, handler, routes.
- Public + customer + admin `Register*` composed; legacy review routes removed.
- Deleted layered review handler/service/repos/model/mappers.

### Verification

```text
go build ./... → green
go test ./internal/... ./pkg/... → green
  including features/reviews
```

### Documentation

- Obsidian: Reviews Backend + maps/ADR/Connect 03
- Docs: domain-map, architecture.md, api/reviews.md
- Workstream FINISHED.md

## Task BE-022 - Migrate recommendations

**Status:** Complete
**Date:** 2026-08-10

### What Changed

- Vertical slice at `internal/features/recommendations/`:
  model, repository, service, handler, routes.
- Public + customer + admin `Register*` composed; legacy routes removed.
- Cron `RecommendationRefreshJob` now depends on `recommendations.Service`.
- Deleted layered recommendation handler/service/repo/model.

### Verification

```text
go build ./... → green
go test ./internal/... ./pkg/... → green
```

### Documentation

- Obsidian: Recommendations Backend + maps/ADR/Connect 03
- Docs: domain-map, architecture.md, api/recommendations.md
- Workstream FINISHED.md

## Task BE-023 - Migrate coupons

**Status:** Complete
**Date:** 2026-08-10

### What Changed

- Vertical slice at `internal/features/coupons/`:
  model, repository, usage_repository, service (+ tests), mapper, handler, routes.
- Extracted shared `models.NullablePatch` to `models/nullable_patch.go`.
- Orders/mocks/integration updated to import `features/coupons` repos + types.
- Public validate is customer-tier; admin CRUD composed; legacy routes removed.
- Coupon service tests avoid mocks package (import cycle).

### Verification

```text
go build ./... → green
go test ./internal/... ./pkg/... → green
  including features/coupons
```

### Documentation

- Obsidian: Coupons Backend + maps/ADR/Connect 03
- Docs: domain-map, architecture.md, api/coupons.md
- Workstream FINISHED.md

## Task BE-024 - Migrate shipping

**Status:** Complete
**Date:** 2026-08-11

### What Changed

- Vertical slice at `internal/features/shipping/`:
  model, zone_repository, method_repository, service (+ validation + tests),
  mapper (+ tests), handler, routes.
- Public + admin `Register*` composed; legacy shipping blocks removed.
- Orders use `*shipping.Service` via existing `shippingAuthorizer` interface
  (return type `*shipping.ShippingMethod`).
- Mocks `ShippingMethodRepo` implements `shipping.MethodRepository`.
- Integration shipping test imports feature package.
- Deleted layered shipping handler/service/repos/model files.

### How to read

```
internal/features/shipping/doc.go
  → routes.go → handler.go → service.go → zone/method_repository.go → model.go
```

### Verification

```text
go build ./... → green
go test ./internal/... ./pkg/... → green
  including features/shipping, routes smoke, order service tests
```

### API contract

Unchanged public shipping + admin zone/method paths and JSON.

### Documentation

- Obsidian: Shipping Backend + maps/ADR/Connect 03/Shipping and Coupons
- Docs: domain-map, architecture.md, api/shipping.md
- Workstream FINISHED.md (this record)

## Task BE-025 - Migrate inventory

**Status:** Complete
**Date:** 2026-08-11

### What Changed

- Vertical slice at `internal/features/inventory/`:
  model, repository, movement_repository, service (+ tests with local stubs),
  mapper (+ tests), handler (+ validation tests), routes.
- Admin `RegisterAdmin` composed; legacy inventory block removed.
- Orders/payments use `inventory.Service`; cart/variant/alerts/seed use
  `inventory.Repository`.
- Mocks implement `inventory.Repository` / `MovementRepository`.
- Integration + seed updated; layered inventory files deleted.

### How to read

```
internal/features/inventory/doc.go
  → routes.go → handler.go → service.go → repository.go → model.go
```

### Verification

```text
go build ./... → green
go test ./internal/... ./pkg/... → green
  including features/inventory, order/payment/cart services, routes
```

### API contract

Unchanged admin inventory paths and JSON.

### Documentation

- Obsidian: Inventory Backend + maps/ADR/Layered Backend
- Docs: domain-map, architecture.md, api/inventory.md
- Workstream FINISHED.md (this record)

## Task BE-026 - Migrate cart

**Status:** Complete
**Date:** 2026-08-11

### What Changed

- Vertical slice at `internal/features/cart/`:
  model, repository, service (+ stock check test), handler, routes.
- Customer `RegisterCustomer` composed; legacy cart block removed.
- Orders + order_item_repo + mocks use `cart.Repository` / `CartItemResponse`.
- Variant lookup via `VariantLookup` interface (satisfied by variant repo).
- Inventory availability via `inventory.Repository`.
- Deleted layered cart handler/service/repo/model.

### How to read

```
internal/features/cart/doc.go
  → routes.go → handler.go → service.go → repository.go → model.go
```

### Verification

```text
go build ./... → green
go test ./internal/... ./pkg/... → green
  including features/cart, order service, routes
```

### API contract

Unchanged customer cart paths and JSON.

### Documentation

- Obsidian: Cart Backend + maps/ADR/Connect 03
- Docs: domain-map, architecture.md, api/cart.md
- Workstream FINISHED.md (this record)

## Task BE-027 - Migrate payments + webhooks

**Status:** Complete
**Date:** 2026-08-11

### What Changed

- Vertical slice at `internal/features/payments/`:
  model, repository, service, mapper (+ tests), admin handler, webhook (+ HMAC tests), routes.
- Public webhook via `RegisterPublic` (idempotency middleware preserved).
- Admin payment reads via `RegisterAdmin`; legacy payment block removed.
- Orders create pending payments via `*payments.Service`.
- Webhook failed path releases stock via inventory.Service + order GetOrderItems.
- Mocks implement `payments.Repository`.
- Deleted layered payment/webhook/mapper/repo/model files.

### How to read

```
internal/features/payments/doc.go
  → routes.go → handler.go → webhook.go → service.go → repository.go → model.go
```

### Verification

```text
go build ./... → green
go test ./internal/... ./pkg/... → green
  including features/payments, routes, order service
```

### API contract

Unchanged admin payment paths, webhook path, and JSON.

### Documentation

- Obsidian: Payments Backend + maps/ADR
- Docs: domain-map, architecture.md, api/payments.md, api/webhooks.md
- Workstream FINISHED.md (this record)

## Task BE-028 - Migrate orders

**Status:** Complete
**Date:** 2026-08-11

### What Changed

- Vertical slice at `internal/features/orders/`:
  model, repository (+ GetStockLines), item_repository, service (+ tests with local stubs),
  mapper, handler (order confirmation email), routes.
- Customer + admin `Register*` composed; legacy order blocks removed.
- Introduced `inventory.StockLine` so inventory/payments do not depend on order DTOs
  (avoids `orders ↔ payments` import cycle).
- Payments use `OrderMarkPaid` (`MarkAsPaid` + `GetStockLines`) and webhook
  `GetOrderStockLines` on the order service.
- `models.PaymentMethod` extracted to `models/payment_method.go` (shared enum).
- Mocks implement `orders.Repository` / `ItemRepository`.
- Deleted layered order handler/service/repos/model/mapper.

### How to read

```
internal/features/orders/doc.go
  → routes.go → handler.go → service.go → repository.go → model.go
```

### Verification

```text
go build ./... → green
go test ./internal/... ./pkg/... → green
  including features/orders, payments, inventory, routes
```

### API contract

Unchanged customer/admin order paths and JSON.

### Documentation

- Obsidian: Orders Backend + maps/ADR/Connect 03
- Docs: domain-map, architecture.md, api/orders.md
- Workstream FINISHED.md (this record)

## Task BE-029 - Migrate media

**Status:** Complete
**Date:** 2026-08-11

### What Changed

- Vertical slice at `internal/features/media/`:
  service (+ transform/upload), lifecycle service, keys, validation,
  lifecycle_repository, content_repository, mapper, handler, routes, tests.
- Public `GET /media/*key` via `RegisterPublicRoot`; admin product images + uploads via `RegisterAdmin`.
- Product/variant/category services import `media.Service` / `LifecycleService`.
- `media.SameMediaURL` + `NormalizeExternalImageURL` exported for catalog/content.
- Hero/blog/recipes `MediaCleaner` satisfied by `LifecycleService`.
- `cmd/media-reconcile` + integration media tests updated.
- ProductImage rows remain on models/catalog repos until catalog migrates.
- Deleted layered media handler/service/repo files.

### How to read

```
internal/features/media/doc.go
  → routes.go → handler.go → service.go → lifecycle.go → repositories
```

### Verification

```text
go build ./... → green
go test ./internal/... ./pkg/... → green
  including features/media, services (product/category), routes
```

### API contract

Unchanged media transform path, admin image/upload paths, and JSON.

### Documentation

- Obsidian: Media Backend + maps/ADR/Connect 03
- Docs: domain-map, architecture.md, api/media.md
- Workstream FINISHED.md (this record)

## Task BE-030 - Migrate catalog core: category, brand, tag, option

**Status:** Complete
**Date:** 2026-08-11

### What Changed

- Vertical slices under `internal/features/catalog/`:
  - `category/` — model, repository, service (+ tree/featured rules, media cleanup),
    handler (cached tree), routes, tests
  - `brand/` — model, repository, service, handler, routes, tests
  - `tag/` — model, repository, service, handler, routes, tests
  - `option/` — option types/values model, repository, service, handler, routes, tests
- Public + admin `Register*` composed for category/brand/tag; option admin-only.
- Legacy catalog blocks removed from `routes/legacy.go`.
- Bootstrap wires feature repos/services/handlers.
- Product layer imports `catalog/tag` for `GetTags` / `ToTagResponse`.
- Option entity types extracted from `models/product_variant.go` (variants stay for BE-031).
- `repositories/pgerr.go` keeps shared PG unique/FK helpers for remaining layered repos.
- Seed + integration tests updated to feature packages.
- Deleted layered category/brand/tag/option handlers, services, repos, models.

### How to read

```
internal/features/catalog/doc.go
  → category|brand|tag|option/doc.go
  → routes.go → handler.go → service.go → repository.go → model.go
```

### Verification

```text
go build ./... → green
go test ./internal/... ./pkg/... → green
  including features/catalog/{category,brand,tag,option}, routes, services
go vet ./internal/features/catalog/... → clean
```

### API contract

Unchanged public/admin category, brand, tag, and option-type paths and JSON.

### Documentation

- Docs: architecture/domain-map.md
- Workstream FINISHED.md (this record)


## Task BE-031 - Migrate catalog products + variants + product_aggregate

**Status:** Complete
**Date:** 2026-08-11

### What Changed

- Vertical slices:
  - `features/catalog/product/` — Product domain, filters/reqs, aggregate snapshot,
    product + image + aggregate repositories, service (+ aggregate), mapper,
    handler (cached public detail), routes
  - `features/catalog/variant/` — ProductVariant domain, repository, service
    (inventory EnsureForVariant), handler, routes
- Public + admin `Register*` composed; product/variant blocks removed from `legacy.go`
  (legacy now analytics-only).
- Bootstrap wires product/variant services and handlers.
- Media uses a local `ProductImageRepository` interface (implemented by product
  image repo) to avoid `media ↔ product` import cycle.
- Cart `VariantLookup` returns `*variant.ProductVariant`; alerts use `variant.Repository`.
- Shared wire DTOs remain in `models/product_response.go` (list/detail/options/images).
- `models.ProductImage` stays shared for media + variant image reads.
- Seed + integration tests updated; layered product/variant handlers/services/repos deleted.

### How to read

```
internal/features/catalog/product/doc.go
  → routes.go → handler.go → service.go → repository.go → model.go
internal/features/catalog/variant/doc.go
  → routes.go → handler.go → service.go → repository.go → model.go
```

### Verification

```text
go build ./... → green
go test ./internal/... ./pkg/... → green
  including features/catalog/product, routes
go vet ./internal/features/catalog/{product,variant}/... → clean
```

### API contract

Unchanged public/admin product, variant, aggregate, and product-tag paths and JSON.

### Documentation

- Docs: architecture/domain-map.md
- Workstream FINISHED.md (this record)


## Task BE-032 - Migrate analytics HTTP + stats services

**Status:** Complete
**Date:** 2026-08-11

### What Changed

- Vertical slice at `internal/features/analytics/`:
  - models: events, daily product/revenue stats, search summary (+ contract test)
  - repositories: event, product stats, revenue stats, search summary
  - services: EventService, DailyProductStatsService, DailyRevenueStatsService,
    SearchSummaryService
  - handler + `RegisterAdmin` under `/admin/analytics/*`
- Capture path preserved: `internal/analytics.Queue` still buffers request events
  and flushes via `features/analytics.EventService`.
- Cron jobs (`product_stats`, `revenue_stats`, `search_summary`) use feature
  services/types.
- Middleware analytics event builder uses feature `EventReq` / `DeviceType`.
- Bootstrap wires feature repos/services/handler; god `Deps` holds `Analytics *Handler`.
- `legacy.go` is empty (no remaining legacy business routes).
- Deleted layered analytics handlers/services/repos/models.

### How to read

```
internal/features/analytics/doc.go
  → routes.go → handler.go → *_service.go → *_repository.go → model_*.go
internal/analytics/queue.go  (capture buffer → EventService.FlushEvents)
```

### Verification

```text
go build ./... → green
go test ./internal/... ./pkg/... → green
  including features/analytics, middlewares, routes
go vet on analytics + corn + bootstrap → clean
```

### API contract

Unchanged admin analytics paths and JSON (revenue/products/search/events).

### Documentation

- Docs: architecture/domain-map.md
- Workstream FINISHED.md (this record)


## Task BE-040 - Feature-local route registration (finish / tighten)

**Status:** Complete
**Date:** 2026-08-11

### What Changed

- `internal/routes/routes.go` is a pure composer: trust groups + `Register*` only.
- Removed empty `legacy.go` and all `registerLegacy*` call sites.
- Renamed `registerMigrated*` → `registerPublic` / `registerCustomer` / `registerAdmin`.
- Grouped Register* calls by domain (identity, content, catalogue, commerce, insights).
- Documented that `features/rbac` remains unmounted until product RBAC rollout.
- Expanded `routes_smoke_test.go` coverage (health, media, auth, catalogue, commerce,
  analytics) to lock path stability.
- Docs: architecture.md + domain-map.md no longer describe a legacy route layer.

### Verification

```text
go build ./... → green
go test ./internal/routes/ → green (expanded smoke)
Every features/*/routes.go exposes RegisterPublic + RegisterCustomer + RegisterAdmin
```

### API contract

Zero path changes; registration only reorganized.

### Documentation

- Docs: architecture.md, architecture/domain-map.md
- Workstream FINISHED.md (this record)


## Task BE-041 - Slim `Handler` / `Deps`

**Status:** Complete
**Date:** 2026-08-11

### What Changed

- `handlers.Handler` / `Deps` is now a **composition root only**:
  - `User *users.Service` for Auth middleware
  - feature `*Handler` fields for `Register*` (no domain service duplicates)
- Removed dead god-handler helpers: `cache.go`, `cache_test.go`, `common.go`
  (features already own cache + httpx bind helpers).
- Bootstrap `Deps{...}` only wires handlers + User.
- Integration tests updated to construct feature handlers directly (product,
  option, variant, media) and to fix package/variable shadowing from prior
  migrations so `go test -tags=integration -c` compiles.

### Verification

```text
go build ./... → green
go test ./internal/... ./pkg/... → green
go test -tags=integration -c ./tests/integration/ → green
```

### API contract

Unchanged.

### Documentation

- Docs: architecture.md
- Workstream FINISHED.md (this record)


## Task BE-042 - Slim `bootstrap/container.go`

**Status:** Complete
**Date:** 2026-08-11

### What Changed

- Each feature package now owns a wiring constructor in `wire.go`:
  - Simple: `New(db, v) *Handler` (wishlist, taste, brand, tag, option, reviews, …)
  - Service-exporting: `New(...) (h *Handler, svc *Service)` (users, wallet, loyalty, …)
  - Repo-exporting for cron/checkout: subscription, coupons, cart, alerts, inventory, variant
  - `auth.Wire(Deps)` assembles password-reset + session kill
  - `analytics.New` returns `Module` (handler + cron services)
  - `media.New` returns handler + lifecycle + service
  - `orders.NewRepos` / `NewWithRepos` and `payments.NewServiceFromDB` / `NewHTTP`
    preserve the payments-before-orders service / orders-before-payments-handler order
- `bootstrap/container.go` `build()` is now an orchestrator only: platform deps →
  feature constructors in dependency order → `handlers.Deps` → container.
- Helpers: `mediaConfig`, `buildNotifications` (inline vs async outbox).
- Behaviour and API contracts unchanged.

### Verification

```text
go build ./... → green
go test ./internal/... ./pkg/... → green
go vet ./internal/bootstrap/ ./internal/features/... → clean
```

### API contract

Unchanged.

### Documentation

- Docs: architecture.md, architecture/domain-map.md
- Workstream FINISHED.md (this record)


## Task BE-043 - Remove empty legacy packages

**Status:** Complete
**Date:** 2026-08-11

### What Changed

Deleted layered packages that had **zero importers** after the feature migration:

| Package | Contents | Action |
|---------|----------|--------|
| `internal/services` | unused `pgx_beginner.go` only | **deleted** |
| `internal/repositories` | unused `pgerr.go` only | **deleted** |
| `internal/mappers` | stub comment-only `product_mappers.go` | **deleted** |

**Kept intentionally (still used):**

| Package | Why |
|---------|-----|
| `internal/handlers` | Composition root (`Deps` + `Handler`) used by bootstrap + routes |
| `internal/models` | Shared errors, filters, `NullablePatch`, `PaymentMethod`, product wire DTOs — hundreds of importers |

Docs updated: architecture.md directory map, domain-map.md (removed packages + models/mappers guidance), plus README and integration README path references.

### Verification

```text
go build ./... → green
go test ./internal/... ./pkg/... → green
```

### API contract

Unchanged.

### Documentation

- Docs: architecture.md, architecture/domain-map.md, docs/README.md, tests/integration/README.md
- Workstream FINISHED.md (this record)


## Task BE-044 - Full regression gate

**Status:** Complete
**Date:** 2026-08-11

### What ran

| Gate | Result |
|------|--------|
| `go build ./...` | green |
| `go test ./...` | green (all packages) |
| `go vet ./...` | clean |
| `go test ./internal/routes/` smoke | green — all critical paths registered |
| `go test -tags=integration ./tests/integration/` | green when `TEST_DATABASE_URL` set (throwaway Postgres 17) |
| Integration without DB | clean skip |

### Smoke / contract spot-check

`routes_smoke_test.go` confirms health, media, identity, catalogue, content,
commerce, and analytics paths still register (admin + storefront criticals).
Feature `routes.go` count: 32 packages; docs under `docs/api/`: 26 files.
No API path/method changes in this workstream.

### Gate fixes (only what blocked integration green)

1. **Media cross-owner mutations** returned 500 instead of 404 —
   `handleMediaError` now maps `models.ErrNotFound` (and defers other domain
   errors to `httpx.HandleError`).
2. **Inventory integration** expected `models.ErrNotFound` but service
   contract is `apperr.ErrNotFound` (matches unit tests).
3. **Option replace missing body** expects 422 (bind+validate), not 400.
4. **Brand slug migration Up** made constraint add idempotent so
   non-destructive Down + re-Up (used by migration round-trip tests) succeeds.

### API contract

JSON keys/paths unchanged. Media not-found status corrected to 404 (intended).

### Documentation

- Workstream FINISHED.md (this record)
- Phase 2 complete

