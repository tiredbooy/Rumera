---
tags: [domain, commerce]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 05 Domains]]


# Catalogue

Products, [[Term variant|variants]], options, images, categories, brands, tags.

## Backend

- Services: product, product_aggregate, variant, option, brand, category, tag
- Public list/detail filters (search, brand, category, sort)
- Media ownership on product images → [[Media Pipeline]]

## Frontend

- `features/catalog/{products,categories,brands,tags}`
- Presentation honesty: [[Storefront Commerce FE]] · `catalogue-presentation`
- Storefront `/products` + `/search` must not paint a `listProducts` outage as an empty catalogue (PR-080f · [[Search FE]])
- Home featured brands are live `GET /brands` (PR-080i). Empty → `[]`; outage throws. No invented liquor names ([[Hero and Home]])
- Cards, PDP, galleries, sort, list-routing
- Admin list (`/admin/products`) pages and searches via `GET /admin/products` — not a client-only first page ([[Admin Console]])

## Rules

- Price/availability from API — no inventing stock
- Use [[Term available_stock]] for purchaseability
- Admin writes revalidate tags → [[Media and Cache FE]]
- Product editor view is `products:read`; save/upload/variant mutate honor `products:write` ([[RBAC]] · [[Journey Admin publish product]])
- New variants always get a zero-stock [[Inventory]] row (aggregate + legacy + standalone)
- Brand `PATCH /admin/brands/:id` title uniqueness **excludes the current brand id** (same as tags; PR-010e). Same-title PATCH is valid; colliding with another brand is `409`. Operator typeahead uses public `GET /brands` — no `GET /admin/brands` ([[Backend API]] · [[Admin Console]]).
- Catalog lookup lists stay `limit` max 100; [[Admin Console]] typeahead pages ([[Known gaps]] — PR-010g not required).
- Product slugs are slugified on write and on `GET /products/slug/:slug` (same helper as brands/categories). Active create/update without a slug is `422`; empty slug = no PDP ([[Journey Admin publish product]] · [[Journey Search to PDP]]).

## Related

[[Search]] · [[Inventory]] · [[Recipes and Journal]] · [[Recommendations]] · [[Business Domains MOC]] · [[Journey Search to PDP]]

#domain #commerce
