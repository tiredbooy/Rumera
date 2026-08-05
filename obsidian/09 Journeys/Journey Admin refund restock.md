---
tags: [journey, inventory]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 09 Journeys]]


# Journey: Admin refund restock

## Actor

Staff with inventory write

## Happy path

1. Customer return accepted operationally (order/payment refund may be separate admin path)
2. Staff opens [[Inventory FE]] variant
3. Adjust with movement type **`refund`** and **positive** quantity (backend rule)
4. `stock_on_hand` increases → available rises
5. Movement ledger records type `refund`

## Notes

- Admin adjust allows `refund` as positive qty ([[Inventory Backend]] `validInventoryAdjustment`)
- This is **manual warehouse** return — not an automated RMA state machine
- Payment `refunded` status on payment transaction is a separate admin/finance concept

## Related

[[Inventory]] · [[Payments]] · [[Playbook Debug Oversell]] · [[Journeys MOC]] · [[Money and stock rules]]

#journey
