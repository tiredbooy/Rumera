# Backend architecture guides

Deep-dives on **how** the Go API is put together. For endpoint request/response
shapes, use [`../api/`](../api/README.md). For onboarding, start at
[`../README.md`](../README.md).

---

## Folder

```
apps/backend/docs/architecture/
├── README.md                 ← this index
├── domain-map.md             ← capability → packages (feature slices complete)
├── data-stores.md            ← Postgres, analytics, Redis, Meili, Kafka, disk
├── inventory.md              ← stock_on_hand / committed / available + order lifecycle
├── payments-and-webhooks.md  ← order pay → HMAC webhook → deduct
├── money-and-stock-sagas.md  ← end-to-end money/stock narrative (PH-000c)
├── idempotency.md            ← production idempotency platform ADR + inventory (PH-011)
├── idempotency-runbook.md    ← ops/debug/FE keys (PH-011e)
├── error-messages.md         ← user-clear error catalogue (PH-012c)
├── media-pipeline.md         ← upload, transform, ownership, reconcile
├── search.md                 ← product discovery + search analytics
├── loyalty.md                ← Cellar Club earn/redeem rules (PH-040a)
├── wallet-topup.md           ← gateway wallet charge (PH-041a)
├── gift-card-purchase.md     ← customer buy gift card (PH-042a)
├── gift-checkout-addons.md   ← modular buy-as-gift packaging fees (PH-060)
├── box-subscriptions.md      ← cellar box product model (PH-043a)
├── box-auto-charge-decision.md ← PH-043c closed: no tokenized auto-charge
├── notifications-kafka.md    ← outbox, worker, topics
└── processes-and-jobs.md     ← server, seed, workers, cron
```

Also related (one level up):

- [`../architecture.md`](../architecture.md) — feature layout, trust tiers, DI, lifecycle  
- [`../how-it-works.md`](../how-it-works.md) — plain-language product story  
- [`../authentication.md`](../authentication.md) — JWT  
- [`../operations.md`](../operations.md) — cache, health, hardening  
- [`../observability.md`](../observability.md) — metrics / tracing  
- monorepo [`docs/DOCUMENTATION-DUAL-TRACK.md`](../../../../docs/DOCUMENTATION-DUAL-TRACK.md)

---

## Read by task

| Task | Guide |
|------|--------|
| Find the right package | [domain-map.md](./domain-map.md) |
| Shared models vs feature-local types | [domain-map.md](./domain-map.md) § Models · [conventions.md](../conventions.md) § Models ownership |
| User-clear error codes / messages | [error-messages.md](./error-messages.md) (PH-012c) |
| Panel RBAC / capabilities | [rbac.md](./rbac.md) (PH-021a) |
| Where to store a new field | [data-stores.md](./data-stores.md) |
| Stock / oversell / low-stock | [inventory.md](./inventory.md) |
| Checkout payment settlement | [payments-and-webhooks.md](./payments-and-webhooks.md) |
| Money/stock end-to-end sagas | [money-and-stock-sagas.md](./money-and-stock-sagas.md) |
| Idempotency keys / retry safety | [idempotency.md](./idempotency.md) · [runbook](./idempotency-runbook.md) |
| Images | [media-pipeline.md](./media-pipeline.md) |
| Storefront search | [search.md](./search.md) |
| Loyalty / Cellar Club rules | [loyalty.md](./loyalty.md) (PH-040a) · [api/loyalty.md](../api/loyalty.md) |
| Wallet gateway top-up | [wallet-topup.md](./wallet-topup.md) (PH-041a) · [api/wallet.md](../api/wallet.md) |
| Cellar box subscriptions | [box-subscriptions.md](./box-subscriptions.md) (PH-043a) · [api/subscriptions.md](../api/subscriptions.md) |
| SMS / email async | [notifications-kafka.md](./notifications-kafka.md) |
| Which binary / cron to run | [processes-and-jobs.md](./processes-and-jobs.md) |

---

## Cross-repo

- [System overview](../../../../docs/SYSTEM-OVERVIEW.md)  
- [Documentation map](../../../../docs/DOCUMENTATION-MAP.md)  
- [Testing](../../../../docs/TESTING.md)  
- [Frontend docs](../../../frontend/docs/README.md)  
