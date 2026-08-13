---
tags: [decision]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 11 Decisions]]


# ADR: Search ILIKE until Meili

**Status:** current / transitional (updated PH-030b 2026-08-12)

**Decision:** Product discovery stays on **Postgres ILIKE** until Meilisearch quality is proven. Meili may be enabled for **index rebuild only** (`MEILI_ENABLED`); it is not the storefront query path.

## As-built

### PH-030a (live query)

- Free-text matches title, description, brand, category after Persian normalize
- `rumera_search_normalize` + `pkg/searchtext` + pg_trgm title indexes

### PH-030b (readiness, no cutover)

- `pkg/meili` HTTP client (health, settings, full rebuild, search helper for tests)
- Document contract includes brand/category titles + `*_search` normalized fields
- Cron `meili_reindex` when client connected; fail-soft boot if Meili down
- Dual-path cutover checklist documented in project `architecture/search.md`
- **Explicit non-goal this task:** wiring `GET /products?search=` to Meili

## Cutover requires

1. Healthy reindex + quality sample vs ILIKE  
2. Hydrate list/stock from Postgres (no Meili-only money/stock)  
3. Explicit flag / hybrid path — not silent switch  

Related: [[Search Backend]] · [[Search]] · [[Search FE]] · [[Journey Search to PDP]]

Bridge: `apps/backend/docs/architecture/search.md`
