---
tags:
  - backend
  - search
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 03 Backend]]


# Search Backend

**Two systems:**

1. **Product discovery (live)** — Postgres ILIKE + Persian normalize (PH-030a)
2. **Search analytics** — events `search_performed` → cron aggregates → admin top terms
3. **Meili index (readiness)** — PH-030b optional rebuild; **not** query authority

## Product discovery (PH-030a)

| Piece | Location |
|-------|----------|
| Filter SQL | `internal/features/catalog/product/repository.go` → `buildProductFilterSQL` |
| Go normalize | `pkg/searchtext` |
| SQL normalize | `rumera_search_normalize(text)` |
| Fields | title, description, brand.title, category.title |

## Meili readiness (PH-030b)

| Piece | Location |
|-------|----------|
| Flag | `MEILI_ENABLED` default false |
| Client | `pkg/meili` |
| Document | `models.MeiliProduct` + `*_search` fields |
| Rebuild | `product.MeiliIndexer` + cron `meili_reindex` |
| Source SQL | `ListForSearchIndex` |

Failure modes: disabled / down at boot → warn, ILIKE continues. No storefront cutover without dual-path checklist in project search.md.

Related: [[Search]] · [[Search FE]] · [[Catalogue]] · [[Analytics]] · [[ADR Search ILIKE until Meili]]

Bridge: `apps/backend/docs/architecture/search.md`

#backend #search
