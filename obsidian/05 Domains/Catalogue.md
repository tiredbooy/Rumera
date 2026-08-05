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
- Cards, PDP, galleries, sort, list-routing

## Rules

- Price/availability from API — no inventing stock
- Use [[Term available_stock]] for purchaseability
- Admin writes revalidate tags → [[Media and Cache FE]]

## Related

[[Search]] · [[Inventory]] · [[Recipes and Journal]] · [[Recommendations]] · [[Business Domains MOC]] · [[Journey Search to PDP]]

#domain #commerce
