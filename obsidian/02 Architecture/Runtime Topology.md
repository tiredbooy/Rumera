---
tags:
  - architecture
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 02 Architecture]]


# Runtime Topology

What runs when you `make dev`.

| Process | Role |
|---------|------|
| nginx | Gateway :80 → FE + `/api/v1` → BE |
| [[Frontend App]] | Next.js storefront + admin + BFF |
| [[Backend API]] | Gin API, analytics queue, in-process cron |
| Postgres main | System of record → [[Data Stores]] |
| Analytics Postgres | Events + rollups |
| Redis | Cache / rate limits |
| Meilisearch | Configured; product search still Postgres today → [[Search]] |
| [[Notifications]] worker | Optional async SMS/email |
| Kafka / Redpanda | Optional notification bus |

See also [[Processes and Jobs]] · [[Docker and Local Dev]] · [[System Atlas]]

#architecture
