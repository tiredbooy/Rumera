---
tags: [journey]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 09 Journeys]]


# Journey: Search to PDP

1. Header search → `/search?q=`
2. [[Search FE]] → `listProducts({ search })` → [[Search Backend]] Persian-aware ILIKE (title/description/brand/category)
3. Successful `GET /products?search=` records `search_performed` (`query` + `results_count`) for [[Analytics]] (PR-070d)
4. Hits → product cards → PDP. Zero hits → empty state. List 5xx/network → retry, not empty (PR-080f)
5. Optionally wishlist / alerts / add cart → [[Cart and Checkout]]

Related: [[Search]] · [[Catalogue]] · [[Surface Storefront]] · [[ADR Search ILIKE until Meili]]

#journey
