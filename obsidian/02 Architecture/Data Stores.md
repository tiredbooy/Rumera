---
tags:
  - architecture
  - data
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 02 Architecture]]


# Data Stores

| Store | Holds | Notes |
|-------|-------|-------|
| Main Postgres | Users, catalogue, cart, orders, inventory, outbox, CMS | Required |
| Analytics Postgres (Timescale) | Events, daily stats, search_summary | Async ingest |
| Redis | Cache, stamps | Not source of truth |
| Meilisearch | Future product index | Prepared types; search uses ILIKE today → [[Search Backend]] |
| Media disk | Originals + transform cache | [[Media Pipeline]] |
| Kafka | Notification events | Optional → [[Notifications]] |

Decision: write money/stock/content to **main**; metrics to **analytics**; rebuild Meili/Redis from sources.

Bridge: `apps/backend/docs/architecture/data-stores.md` · [[Docs Bridge Backend]]

Related: [[Inventory]] · [[Payments]] · [[Analytics]] · [[Layered Backend]]

#architecture #data
