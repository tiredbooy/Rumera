# Backend domain map

**Who this is for:** engineers who need to find the right package for a business
capability without grepping the whole tree.

**Companion:** [Architecture](../architecture.md) · [API reference](../api/README.md) ·
[Data stores](./data-stores.md)

---

## Layer reminder

```
routes  →  handlers  →  services  →  repositories  →  models / SQL
                ↘ mappers (DTO projection)
```

Bootstrap wires the graph once in `internal/bootstrap/container.go`.

---

## Capability → code

| Capability | Handler | Service package | Notes |
|------------|---------|-----------------|-------|
| Auth / JWT / OTP | `auth*.go`, `password_reset.go` | `user`, OTP in handlers + sms | Tokens via `pkg/token` |
| Users / admin customers | `user.go` | `user` | Public UUID `user_id` + int `id` |
| Products | `product.go`, `product_aggregate.go` | `product`, aggregate | Variants separate |
| Variants / options | `variant.go`, `option.go` | `variant`, `option` | SKU, price, stock hooks |
| Categories | `catry.go` | category service | Filename historical |
| Brands / tags | `brand.go`, `tag.go` | `brand`, `tag` | |
| Media | `media.go` | `media*` | Upload, transform, ownership |
| Cart | `cart.go` | `cart` | Customer-scoped |
| Addresses | `address.go` | `address` | |
| Shipping | `shipping.go` | `shipping` | Quotes authoritative |
| Coupons | `coupon.go` | `coupon` | |
| Orders | `order.go` | `order` | Confirmation emails via Dispatcher |
| Payments / webhooks | `payment.go`, `webhook.go` | `payment` | Idempotency records |
| Wallet | `wallet.go` | wallet service | |
| Wishlist | `wishlist.go` | wishlist | |
| Reviews | `review.go` | `review` | |
| Inventory | `inventory.go` | `inventory` | Movements |
| Recipes | `recipe.go` | `recipe` | Shoppable links |
| Blog / journal | `blog.go` | `blog` | |
| Hero slides | `hero_slide.go` | `hero_slide` | |
| Site settings | `site_settings.go` | `site_settings` | |
| Recommendations | `recommendation.go` | `recommendation` | Cron rebuilds |
| Alerts | `alert.go` | `alert` | Cron notifies |
| Loyalty / gift / sub / referral / taste | respective handlers | matching services | Account domains |
| Analytics HTTP | `analytics.go` | stats services + analytics DB | |
| Cache admin | `cache.go` | — | Bust Redis / tags helpers |
| Notifications | (via Dispatcher) | `internal/notifications` | Not a public REST resource |

Exact routes: `internal/routes/routes.go` and `docs/api/*.md`.

---

## Models vs wire DTOs

- `internal/models` holds **domain structs**, request filters, and response
  shapes used at the HTTP boundary.
- `internal/mappers` projects domain → response DTOs (JSON tags define the
  frontend contract).
- Do **not** treat every DB column as a public field — omit internal columns.

Frontend TypeScript types must match **JSON tags**, not Go field names.

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
- Dispatcher used by handlers
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
2. Model + repository + service + mapper + handler.
3. Register routes with the correct trust group (public / customer / admin).
4. Wire in `bootstrap/container.go`.
5. Document the endpoint under `docs/api/`.
6. Frontend domain types + clients follow Go JSON (separate PR/task as needed).
