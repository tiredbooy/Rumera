---
tags: [journey, admin, inventory]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 09 Journeys]]


# Journey: Admin restock

1. Staff login with inventory write → [[RBAC]]
2. `/admin/inventory?low_stock=true` (server `GET /admin/inventory`, not a client-only table filter) → [[Inventory FE]]
3. If the list GET fails, staff see «دریافت موجودی ناموفق بود» + retry — not an empty warehouse (PR-063b)
4. List rows show «وزن ناقص» when `missing_weight` (PH-020a wire + PH-020b UI)
5. Filter «وزن بسته‌بندی» or KPI «وزن ناقص» → open product to set kg
6. Variant detail → adjust type `restock` positive qty
7. Movement ledger updates · available rises
8. Storefront may need cache/TTL for list availability (60s product list tags)

Related: [[Inventory]] · [[Inventory Backend]] · [[Playbook Debug Oversell]] · [[Surface Admin]]

#journey
