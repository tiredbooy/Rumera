---
tags: [domain]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 05 Domains]]


# Wishlist and Reviews

## Wishlist

- Customer-scoped saved products/variants
- Must not treat **committed** stock as free to buy → [[Term available_stock]]
- Line `options` are hydrated from catalogue variant option values ([[Catalogue]] · [[Wishlist Backend]]) in one query. Empty/omitted when the variant has none.
- FE: `features/wishlist` · account wishlist view
- BE: **`internal/features/wishlist`** · [[Wishlist Backend]]; ownership by `uid`
- Edge cases: [[Playbook Wishlist stock honesty]]

## Reviews

- Customer reviews on products; list on PDP
- Account “my reviews”; admin moderation board
- BE: [[Reviews Backend]] (`internal/features/reviews`); verified-purchase badge for buyers
- FE: `features/reviews` · account reviews · admin reviews
- Admin queue shows `product_title` (slug / `#id` fallback) — not a bare product id (PR-063d)

## Related

[[Catalogue]] · [[Account Domain]] · [[Inventory]] · [[Admin Console]] · [[Business Domains MOC]]

#domain
