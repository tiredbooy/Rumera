---
tags:
  - backend
  - search
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 03 Backend]]


# Search Backend

**Two systems:**

1. **Product discovery** — today Postgres `ILIKE` on title via `GET /products?search=`
2. **Search analytics** — events `search_performed` → cron aggregates → admin top terms

Meilisearch: config + `MeiliProduct` shape **prepared**, client **not wired** in bootstrap.

Related: [[Search]] · [[Search FE]] · [[Catalogue]] · [[Analytics]]

Bridge: `apps/backend/docs/architecture/search.md`

#backend #search
