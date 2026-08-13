---
tags: [journey, admin, inventory]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 09 Journeys]]


# Journey: Admin restock

1. Staff login with inventory write → [[RBAC]]
2. `/admin/inventory` → filter low stock → [[Inventory FE]]
3. List rows show «وزن ناقص» when `missing_weight` (PH-020a wire + PH-020b UI)
4. Filter «وزن بسته‌بندی» or KPI «وزن ناقص» → open product to set kg
5. Variant detail → adjust type `restock` positive qty
6. Movement ledger updates · available rises
7. Storefront may need cache/TTL for list availability (60s product list tags)

Related: [[Inventory]] · [[Inventory Backend]] · [[Playbook Debug Oversell]] · [[Surface Admin]]

#journey
