---
tags: [journey, admin, inventory]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 09 Journeys]]


# Journey: Admin restock

1. Staff login with inventory write → [[RBAC]]
2. `/admin/inventory` → filter low stock → [[Inventory FE]]
3. Variant detail → adjust type `restock` positive qty
4. Movement ledger updates · available rises
5. Storefront may need cache/TTL for list availability (60s product list tags)

Related: [[Inventory]] · [[Inventory Backend]] · [[Playbook Debug Oversell]] · [[Surface Admin]]

#journey
