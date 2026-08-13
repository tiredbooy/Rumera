---
tags: [code, backend]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 10 Code Maps]]


# Backend package map

**As-built 2026-08-11** — Phase 2 feature slices complete.

```text
apps/backend/
├── cmd/
│   ├── server/                 # [[Backend API]] entry
│   ├── seed/
│   ├── notification-worker/    # [[Notifications]]
│   └── media-reconcile/        # [[Media Pipeline]]
├── configs/
├── internal/
│   ├── bootstrap/              # DI orchestrator (calls feature wire.go)
│   ├── routes/
│   │   ├── routes.go           # composer only (Register*)
│   │   └── routes_smoke_test.go
│   ├── features/               # ★ all business domains
│   │   ├── auth/               # [[Auth and Sessions]]
│   │   ├── users/
│   │   ├── rbac/               # [[RBAC]]
│   │   ├── addresses/          # [[Addresses Backend]]
│   │   ├── wishlist/           # [[Wishlist Backend]]
│   │   ├── wallet/             # [[Wallet Backend]]
│   │   ├── loyalty/            # [[Loyalty Backend]]
│   │   ├── referral/           # [[Referral Backend]]
│   │   ├── giftcard/           # [[Gift Card Backend]]
│   │   ├── subscription/       # [[Subscriptions Backend]]
│   │   ├── alerts/             # [[Product Alerts Backend]]
│   │   ├── taste/              # [[Taste Profile Backend]]
│   │   ├── site_settings/
│   │   ├── hero/
│   │   ├── blog/
│   │   ├── recipes/
│   │   ├── reviews/
│   │   ├── recommendations/
│   │   ├── coupons/
│   │   ├── shipping/
│   │   ├── inventory/
│   │   ├── cart/
│   │   ├── payments/
│   │   ├── orders/
│   │   ├── media/
│   │   ├── analytics/
│   │   └── catalog/
│   │       ├── product/
│   │       ├── variant/
│   │       ├── option/
│   │       ├── category/
│   │       ├── brand/
│   │       └── tag/
│   ├── platform/httpx/
│   ├── handlers/               # composition root ONLY (handler.go + Deps)
│   ├── models/                 # shared cross-feature ONLY (see below)
│   ├── middlewares/
│   ├── notifications/
│   ├── analytics/              # capture queue (not HTTP feature)
│   └── corn/                   # [[Processes and Jobs]]
├── migrations/
├── pkg/
└── docs/
```

## `internal/models` (PH-012a)

**Not** a god domain package. Only:

| Area | Files |
|------|--------|
| Sentinels | `errors.go` |
| List helpers | `filter.go`, `pagination.go` |
| PATCH omit vs null | `nullable_patch.go` |
| Payment rail enum | `payment_method.go` |
| Catalogue wire DTOs | `product_response.go`, `product_image.go` |
| Checkout tax | `tax.go` |

Everything else (order, payment transaction, inventory row, wallet, cart, …)
lives under **`internal/features/<name>/`**. Package rules: repo
`apps/backend/docs/conventions.md` § Models ownership · `models/doc.go`.
Wire contract: [[Wire contracts]].

## Feature → domain (quick)

| Package | Domain notes |
|---------|----------------|
| `features/auth` | [[Auth and Sessions]] |
| `features/users` | Customers admin · profile |
| `features/rbac` | [[RBAC]] |
| `features/wallet` | [[Wallet Backend]] · [[Loyalty Wallet Gift Cards]] |
| `features/loyalty` | [[Loyalty Backend]] |
| `features/orders` | [[Orders Backend]] · [[Orders]] |
| `features/payments` | [[Payments Backend]] · [[Payments]] |
| `features/inventory` | [[Inventory Backend]] · [[Inventory]] |
| `features/cart` | [[Cart Backend]] · [[Cart and Checkout]] |
| `features/catalog/*` | [[Catalogue]] |
| `features/subscription` | [[Subscriptions Backend]] · box model (not Netflix) |

Full table: repo `apps/backend/docs/architecture/domain-map.md`.

Related: [[Layered Backend]] · [[Backend Domain Map]] · [[ADR Backend feature packages]] · [[System Atlas]]

#code #backend
