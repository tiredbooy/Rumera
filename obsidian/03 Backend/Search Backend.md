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
2. **Search analytics** — `GET /products?search=` → `search_performed` (`query` + `results_count`) → cron aggregates → admin top terms. No `GET /search`. List errors do not invent zero hits.
3. **Meili index (readiness)** — PH-030b optional rebuild; **not** query authority

## Product discovery (PH-030a)

| Piece | Location |
|-------|----------|
| Filter SQL | `internal/features/catalog/product/repository.go` → `buildProductFilterSQL` |
| Go normalize | `pkg/searchtext` |
| SQL normalize | `rumera_search_normalize(text)` |
| Fields | title, description, code, brand.title, category.title, variant.sku, tag.title |
| Journal / recipes (PR-070h) | `blog` + `recipes` list `search=` on `rumera_search_normalize(title\|excerpt)` |
| Price facets | `min_price` / `max_price` EXISTS require `pv.is_active` — inactive variants do not match |

## Meili readiness (PH-030b)

| Piece | Location |
|-------|----------|
| Flag | `MEILI_ENABLED` default false |
| Client | `pkg/meili` |
| Document | `models.MeiliProduct` + `*_search` fields |
| Rebuild | `product.MeiliIndexer` + cron `meili_reindex` |
| Source SQL | `ListForSearchIndex` |

Failure modes: disabled / down at boot → warn, ILIKE continues. No storefront cutover without dual-path checklist in project search.md.

**PR-070d:** `GET /products?search=` (non-empty) is `search_performed` with
`query` + `results_count`. Failed list does not invent zero hits. Admin
product search is not this event.

Related: [[Search]] · [[Search FE]] · [[Catalogue]] · [[Analytics]] · [[ADR Search ILIKE until Meili]]

Bridge: `apps/backend/docs/architecture/search.md`

#backend #search
