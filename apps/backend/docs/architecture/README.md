# Backend architecture guides

Deep-dives on **how** the Go API is put together. For endpoint request/response
shapes, use [`../api/`](../api/README.md). For onboarding, start at
[`../README.md`](../README.md).

---

## Folder

```
apps/backend/docs/architecture/
├── README.md                 ← this index
├── domain-map.md             ← capability → packages
├── data-stores.md            ← Postgres, analytics, Redis, Meili, Kafka, disk
├── inventory.md              ← stock_on_hand / committed / available + order lifecycle
├── payments-and-webhooks.md  ← order pay → HMAC webhook → deduct
├── media-pipeline.md         ← upload, transform, ownership, reconcile
├── search.md                 ← product discovery + search analytics
├── notifications-kafka.md    ← outbox, worker, topics
└── processes-and-jobs.md     ← server, seed, workers, cron
```

Also related (one level up):

- [`../architecture.md`](../architecture.md) — layers, DI, request lifecycle  
- [`../authentication.md`](../authentication.md) — JWT  
- [`../operations.md`](../operations.md) — cache, health, hardening  
- [`../observability.md`](../observability.md) — metrics / tracing  

---

## Read by task

| Task | Guide |
|------|--------|
| Find the right package | [domain-map.md](./domain-map.md) |
| Where to store a new field | [data-stores.md](./data-stores.md) |
| Stock / oversell / low-stock | [inventory.md](./inventory.md) |
| Checkout payment settlement | [payments-and-webhooks.md](./payments-and-webhooks.md) |
| Images | [media-pipeline.md](./media-pipeline.md) |
| Storefront search | [search.md](./search.md) |
| SMS / email async | [notifications-kafka.md](./notifications-kafka.md) |
| Which binary / cron to run | [processes-and-jobs.md](./processes-and-jobs.md) |

---

## Cross-repo

- [System overview](../../../../docs/SYSTEM-OVERVIEW.md)  
- [Documentation map](../../../../docs/DOCUMENTATION-MAP.md)  
- [Testing](../../../../docs/TESTING.md)  
- [Frontend docs](../../../frontend/docs/README.md)  
