---
tags:
  - frontend
  - search
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 04 Frontend]]


# Search FE

Header search → `/search?q=` → RSC `listProducts({ search })` → `GET /products?search=` → product cards. Backend records `search_performed` on that list (not `GET /search`).

A rejected search list is **not** zero hits (PR-080f). Show `CatalogueLoadError`
+ `router.refresh()` retry. Successful empty stays «نتیجه‌ای پیدا نشد». Idle
suggestions may fail soft; the queried list must not settle to `[]`.

Placeholder and zero-hit copy list title, description, brand, category,
code, SKU, and tag (PR-080p) — not title-only. Slug is not matched.

`/products` uses the same split — outage ≠ «محصولی برای نمایش نیست».

Admin `/admin/products` uses the same backend ILIKE `search` on
`GET /admin/products` (URL `q` / `search`) — see [[Admin Console]].

Engine is backend [[Search Backend]] (Persian-aware ILIKE, PH-030a). Meili index readiness exists server-side (PH-030b) but FE must not call Meili.

Related: [[Search]] · [[Catalogue]] · [[Storefront Commerce FE]]

Bridge: `apps/frontend/docs/features/search.md`

#frontend #search
