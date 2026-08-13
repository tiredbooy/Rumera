---
tags: [domain, inventory]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 05 Domains]]


# Inventory

Warehouse truth for sellable bottles.

## Formula

```text
available_stock = stock_on_hand - committed_stock
```

| Counter | Role |
|---------|------|
| [[Term stock_on_hand]] | Physical |
| [[Term committed_stock]] | Held for open orders |
| [[Term available_stock]] | Sellable (derived) |

## Lifecycle

| Event | Op | Who |
|-------|-----|-----|
| Place order | Reserve | [[Orders]] / CreateOrder TX |
| Pay fail / cancel | Release | [[Payments]] / cancel |
| Pay success | Deduct | Payment Confirm TX |
| Staff restock | Adjust | [[Inventory FE]] |

## Weight on list wire (PH-020a)

Admin inventory list/detail now includes catalogue package weight:

| Field | Meaning |
|-------|---------|
| `weight` | kg from `products.weight` (omitted when unset) |
| `missing_weight` | true if null or ≤ 0 — fix product before shipping quotes |

FE type: `InventoryItem` in `features/inventory/types.ts`.  
UI: badge + filter + KPI + detail callout (**PH-020b** / Refactor-Docs **085a** closed).

## Code

- BE: [[Inventory Backend]] · `features/inventory`
- FE: [[Inventory FE]] · `/admin/inventory`
- Docs: `architecture/inventory.md` · `api/inventory.md` via [[Docs Bridge Backend]]

## Related

[[Money and stock rules]] · [[Playbook Debug Oversell]] · [[Journey Admin restock]] · [[ADR Stock available not on-hand]] · [[ADR Order reserve and pay deduct atomic]]

#domain #inventory
