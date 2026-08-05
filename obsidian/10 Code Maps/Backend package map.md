---
tags: [code, backend]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 10 Code Maps]]


# Backend package map

```text
apps/backend/
├── cmd/
│   ├── server/                 # [[Backend API]] entry
│   ├── seed/                   # [[Seed and Demo Data]]
│   ├── notification-worker/    # [[Notifications]]
│   └── media-reconcile/        # [[Media Pipeline]]
├── configs/                    # [[Env and config]]
├── internal/
│   ├── bootstrap/              # DI container
│   ├── routes/                 # route tree
│   ├── handlers/               # HTTP
│   ├── services/               # business
│   ├── repositories/           # SQL
│   ├── models/ · mappers/
│   ├── middlewares/
│   ├── notifications/          # outbox domain
│   ├── analytics/              # event queue
│   └── corn/                   # cron [[Processes and Jobs]]
├── migrations/main|analytics   # [[Migrations]]
├── pkg/                        # apperr, cache, token, storage, imaging, …
└── docs/                       # [[Docs Bridge Backend]]
```

## Handler → domain (selected)

| Handler | Domain |
|---------|--------|
| product*, variant, option | [[Catalogue]] |
| cart, address, order | [[Cart and Checkout]] · [[Orders]] |
| inventory | [[Inventory]] |
| payment, webhook | [[Payments]] |
| media | [[Media Pipeline]] |
| recipe, blog, hero | [[Recipes and Journal]] · [[Hero and Home]] |
| wallet, loyalty, gift_card | [[Loyalty Wallet Gift Cards]] |
| referral | [[Referrals Backend]] |
| alert | [[Product Alerts Backend]] |
| subscription | [[Subscriptions Backend]] |
| auth* | [[Auth and Sessions]] |

Related: [[Backend Domain Map]] · [[Layered Backend]] · [[Code Maps MOC]]
