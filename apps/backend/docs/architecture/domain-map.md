# Backend domain map

**Who this is for:** engineers who need to find the right package for a business
capability without grepping the whole tree.

**Companion:** [Architecture](../architecture.md) · [API reference](../api/README.md) ·
[Data stores](./data-stores.md)

---

## Layer reminder

**As-built (Phase 2 complete — 2026-08-11):**

```
routes (composer) → features/<name>/{routes,handler,service,repository,model,wire}
pkg/* shared libraries · platform/httpx shared bind helpers
handlers/  → composition root only (Deps: feature handlers + User + RBAC)
models/    → shared errors, filters, NullablePatch, product wire DTOs
```

Each feature owns a package constructor (`wire.go` — `New` / `Wire` / `NewRepos`).
Bootstrap (`internal/bootstrap/container.go`) only orders cross-feature deps and
assembles `handlers.Deps`. The router composes only `feature.Register*`.
There is **no** `routes/legacy.go`.

**Removed:** empty layered packages `internal/services`, `internal/repositories`,
`internal/mappers`. Domain code lives under `features/`.

Catalogue = umbrella `features/catalog/{product,variant,option,category,brand,tag}`.  
Account extras = flat packages (`wallet`, `loyalty`, `subscription`, …).

Charter (historical): `refactor-workstreams/backend-feature-architecture/CHARTER.md`.

---

## Capability → code

| Capability | Handler | Service package | Notes |
|------------|---------|-----------------|-------|
| Auth / JWT / OTP | **`features/auth`** | **`features/auth`** (+ users) | JWT via `pkg/token`; `RegisterPublic` |
| Users / admin customers | **`features/users`** | **`features/users`** | Full vertical slice; `RegisterAdmin` |
| Panel RBAC / capabilities | **`features/rbac`** | **`features/rbac`** | Matrix + admin routes; `mw.RequirePermission` on write surfaces |
| Addresses | **`features/addresses`** | **`features/addresses`** | Customer-scoped; `RegisterCustomer` |
| Wishlist | **`features/wishlist`** | **`features/wishlist`** | One list per user; `GetItems` hydrates line `options` from variant option values (one query, not N+1); `RegisterCustomer` |
| Wallet | **`features/wallet`** | **`features/wallet`** | Customer read + admin credit; `RegisterCustomer`/`Admin` |
| Loyalty | **`features/loyalty`** | **`features/loyalty`** | Points / redeem to wallet |
| Referral | **`features/referral`** | **`features/referral`** | Codes; awards via loyalty |
| Gift cards | **`features/giftcard`** | **`features/giftcard`** | Issue admin + redeem customer |
| Subscriptions | **`features/subscription`** | **`features/subscription`** | Physical cellar box (not Netflix); [box-subscriptions.md](./box-subscriptions.md) |
| Product alerts | **`features/alerts`** | **`features/alerts`** | Restock / price-drop; GET list hydrates title/slug/price |
| Taste profile | **`features/taste`** | **`features/taste`** | Personalisation quiz |
| Site settings | **`features/site_settings`** | **`features/site_settings`** | Public GET + admin PUT; cached |
| Hero slides | **`features/hero`** | **`features/hero`** | Home carousel; MediaCleaner for images |
| Blog / journal | **`features/blog`** | **`features/blog`** | Posts + categories; MediaCleaner |
| Recipes | **`features/recipes`** | **`features/recipes`** | Shoppable products; cached public detail; MediaCleaner |
| Reviews | **`features/reviews`** | **`features/reviews`** | Ratings, reactions, images; public + customer + admin |
| Recommendations | **`features/recommendations`** | **`features/recommendations`** | Trending/similar/FBT/for-you; cron profile refresh |
| Coupons | **`features/coupons`** | **`features/coupons`** | Validate + admin CRUD; orders use repo under lock |
| Shipping | **`features/shipping`** | **`features/shipping`** | Zones/methods; quotes authoritative; orders authorize via service |
| Products + aggregate | **`features/catalog/product`** | **`features/catalog/product`** | CRUD, tags, aggregate snapshot; wire DTOs still in `models/product_response.go` |
| Variants | **`features/catalog/variant`** | **`features/catalog/variant`** | SKU CRUD + option links; cart/alerts use Repository |
| Option types/values | **`features/catalog/option`** | **`features/catalog/option`** | Admin option catalogue CRUD |
| Categories | **`features/catalog/category`** | **`features/catalog/category`** | Tree + featured; cached public tree |
| Brands | **`features/catalog/brand`** | **`features/catalog/brand`** | Public list + admin CRUD |
| Tags | **`features/catalog/tag`** | **`features/catalog/tag`** | Public list + admin CRUD; product junction still layered |
| Media | **`features/media`** | **`features/media`** | Upload, transform, lifecycle; product images via catalog repos |
| Cart | **`features/cart`** | **`features/cart`** | Customer-scoped; `GetItems` hydrates line `options` from variant option values (one query, not N+1); orders use repo under tx |
| Orders | **`features/orders`** | **`features/orders`** | Checkout + lifecycle; payments use MarkAsPaid/GetStockLines |
| Payments / webhooks | **`features/payments`** | **`features/payments`** | Admin reads + gateway webhook; orders create pending |
| Inventory | **`features/inventory`** | **`features/inventory`** | Stock + movements; orders/payments lifecycle |
| Analytics HTTP + stats | **`features/analytics`** | **`features/analytics`** | Admin dashboards; cron roll-ups; capture via `internal/analytics.Queue` |
| Notifications | (via Dispatcher) | `internal/notifications` | Not a public REST resource |

Exact routes: `internal/routes/routes.go` and `docs/api/*.md`.

Catalog lookup lists stay `limit` max 100; admin typeahead pages.

---

## Models vs wire DTOs

**Policy (PH-012a):** feature packages own domain + wire types; `internal/models`
is a **shared primitives** package with an explicit package doc (`models/doc.go`).
Full decision tree: [conventions.md § Models ownership](../conventions.md).

| Belongs in feature | Belongs in `internal/models` |
|--------------------|------------------------------|
| Entity, req/resp used by one domain | Sentinel errors used by 2+ features |
| Feature mappers (`features/…/mapper.go`) | `BaseFilter`, pagination, `NullablePatch` |
| Local enums that never cross features | `PaymentMethod`, checkout `TaxRate` |
| Inventory / payment transaction entities | Catalogue list/detail wire DTOs still shared by product/variant/media (cycle avoidance) |

**As-built check (PH-012a):** no domain files remain under `internal/models` for
orders, payments, inventory, wallet, cart, etc. Those live under
`internal/features/<name>/model.go`. Stale guide paths that still said
`internal/models/inventory.go` or `payment_transaction.go` were corrected.

There is **no** `internal/mappers` package.  
Do **not** treat every DB column as a public field.  
Frontend TypeScript types must match **JSON tags**, not Go field names.

**Handlers:** map errors with `httpx.HandleError` so `models.Err*` → correct HTTP
codes (see conventions § Error mapping path). Residual sentinel → status gaps
are **PH-012b**.

---

## Cross-cutting packages (`pkg/`)

| Package | Role |
|---------|------|
| `apperr` | Typed errors → HTTP codes |
| `response` | Success / error / paginated envelopes |
| `database` | Pools, goose runner helpers |
| `cache` | Redis |
| `token` | JWT issue/parse |
| `crypto` | Passwords, secure tokens |
| `storage` | Blob store (local disk today) |
| `imaging` | Transform pipeline (vips/stdlib) |
| `sms` / `notify` | Provider interfaces |
| `metrics` / `tracing` | Observability |
| `middleware` | Generic HTTP middleware |
| `validator` | Struct validation |

---

## Notifications domain (async)

Package `internal/notifications` is a **vertical slice**:

- envelopes + topics
- outbox claim/mark published
- delivery ledger
- Dispatcher used by handlers and cron (alerts, cellar-box renewal)
- `postgres/` + `kafka/` adapters
- consumed by `cmd/notification-worker`

See [notifications-kafka.md](./notifications-kafka.md).

---

## Analytics domain

- Capture middleware → buffered queue → analytics DB (`internal/analytics`).
- Rollup jobs in `internal/corn` write daily product/revenue stats.
- Admin analytics handlers read aggregates — not the hot request path.

---

## How to add a capability

1. Migration in `migrations/main` (or `analytics` if time-series only).
2. Model + repository + service + mapper + handler + `routes.go`.
3. Add `wire.go` with a package-level `New` (repo → service → handler).
4. Register routes with the correct trust group (public / customer / admin).
5. Call the feature constructor from `bootstrap/container.go` and add the
   handler to `handlers.Deps`.
6. Document the endpoint under `docs/api/`.
7. Frontend domain types + clients follow Go JSON (separate PR/task as needed).
