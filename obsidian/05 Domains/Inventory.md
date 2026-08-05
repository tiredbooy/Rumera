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

## Code

- BE: [[Inventory Backend]] · `inventory_svc.go`
- FE: [[Inventory FE]] · `/admin/inventory`
- Docs: `architecture/inventory.md` via [[Docs Bridge Backend]]

## Related

[[Money and stock rules]] · [[Playbook Debug Oversell]] · [[Journey Admin restock]] · [[ADR Stock available not on-hand]] · [[ADR Order reserve and pay deduct atomic]]

#domain #inventory
