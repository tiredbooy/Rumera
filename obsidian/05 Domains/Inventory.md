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

Reserve / release / deduct take inventory row locks in **VariantID ascending** order. [[Orders Backend]] `GetStockLines` sorts before return (PR-020k) so webhook deduct/release cannot 40P01 against another checkout ([[Money and stock rules]]).

## Weight on list wire (PH-020a)

Admin inventory list/detail now includes catalogue package weight:

| Field | Meaning |
|-------|---------|
| `weight` | kg from `products.weight` (omitted when unset) |
| `missing_weight` | true if null or ≤ 0 — fix product before shipping quotes |

FE type: `InventoryItem` in `features/inventory/types.ts`.  
UI: badge + filter + KPI + detail callout (**PH-020b** / Refactor-Docs **085a** closed).

Admin list (PR-063a) pages on the server: `q` / `page` / `low_stock` → `GET /admin/inventory`. Catalog SKU and low-stock KPI cards use `pagination.total_items`; out-of-stock / missing-weight / stock-value tiles are the current page only.

A failed list read is a retryable error (PR-063b), not “no SKUs”. Empty catalogue and empty search stay separate from outage.

## Variant create (PR-010a)

Every new variant gets a **zero-stock** inventory row in the same write:

| Path | How |
|------|-----|
| Standalone `POST /admin/products/:id/variants` | `EnsureForVariant` after insert |
| Editor aggregate `POST/PUT …/aggregate` | `EnsureForVariantTx` in the product TX |
| Legacy `POST /admin/products` inline variants | `EnsureForVariantTx` via `insertVariantTx` |

Failure to ensure inventory rolls the variant write back. Stock stays 0 until [[Journey Admin restock]]. Without the row the SKU is not purchasable and disappears from admin stock tools.

## Code

- BE: [[Inventory Backend]] · `features/inventory`
- FE: [[Inventory FE]] · `/admin/inventory`
- Docs: `architecture/inventory.md` · `api/inventory.md` via [[Docs Bridge Backend]]

## Related

[[Money and stock rules]] · [[Playbook Debug Oversell]] · [[Journey Admin restock]] · [[ADR Stock available not on-hand]] · [[ADR Order reserve and pay deduct atomic]]

#domain #inventory
