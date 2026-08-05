---
tags: [playbook]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 12 Playbooks]]


# Playbook: Wishlist stock honesty

## Symptoms / when to use

Wishlist shows “available” for items that cart rejects; or add-to-cart works for committed-only stock.

## Steps

1. Confirm UI uses **available** (or API fields that derive from available), not raw on-hand → [[Term available_stock]]
2. Backend cart add / order reserve must check available under lock
3. Integration: committed inventory unavailable to cart/wishlist (`tests/integration/inventory_test.go`)
4. If wishlist caches client-side, invalidate on stock-sensitive navigation
5. Don’t invent client-side stock counters from stale list payloads

## Verify

- Reserve N units on last stock → second cart cannot buy
- Wishlist badge/count does not imply purchasable if OOS

## Related

[[Wishlist and Reviews]] · [[Inventory]] · [[Cart and Checkout]] · [[Playbook Debug Oversell]] · [[Playbooks MOC]]

#playbook
