---
tags:
  - domain
  - search
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 05 Domains]]


# Search

Shopper product discovery + admin search analytics.

- UX: [[Search FE]]
- Engine today: [[Search Backend]] — Persian-aware Postgres ILIKE (PH-030a)
  - Matches title / description / brand / category after normalize
  - Confusables: `ك/ي` → `ک/ی`; ZWNJ + whitespace stripped
- Analytics rollups for merchandising
- Meili: **PH-030b readiness** (`MEILI_ENABLED` + reindex cron); not live query authority

Related: [[Catalogue]] · [[Analytics]] · [[ADR Search ILIKE until Meili]] · [[Journey Search to PDP]]

#domain #search
