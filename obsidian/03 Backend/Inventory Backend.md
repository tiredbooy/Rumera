---
tags:
  - backend
  - inventory
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 03 Backend]]


# Inventory Backend

Stock counters per **product variant**.

| Field | Meaning |
|-------|---------|
| `stock_on_hand` | Physical units |
| `committed_stock` | Held for open orders |
| `available_stock` | **Derived** `on_hand - committed` |

## Lifecycle

1. **Reserve** on place order (same TX as order) → [[Orders]] · [[Cart and Checkout]]
2. **Release** on cancel / payment fail → [[Payments Backend]]
3. **Deduct** on payment confirm (same TX as paid)

Admin adjust / reorder / movements ledger → [[Inventory FE]].

Related: [[Inventory]] · [[Payments]] · [[Catalogue]]

Bridge: `apps/backend/docs/architecture/inventory.md` · `api/inventory.md`

#backend #inventory
