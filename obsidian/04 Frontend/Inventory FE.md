---
tags:
  - frontend
  - inventory
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 04 Frontend]]


# Inventory FE

`/admin/inventory` list + `/admin/inventory/[variantID]` detail.

- Permissions: inventory read/write → [[RBAC]]
- Shows available vs committed vs on-hand
- List is **one server page** (`limit` 20) — URL `q`, `page`, `low_stock=true` map to `GET /admin/inventory` (`search` / `low_stock`). Do not walk `listAllInventory()`.
- Failed list GET is `AdminDataErrorState` + retry — not empty warehouse copy. Auth `401`/`403` still throw. (PR-063b)
- Adjust / reorder / movements UI
- Domain API: `features/inventory` · boards: `features/admin/inventory`
- Admin-home `LowStockList` prints live `product_title` (SKU / `#id` fallback). See [[Admin Analytics]] (PR-063c).

Related: [[Inventory]] · [[Inventory Backend]] · [[Admin Console]] · [[Catalogue]]

Bridge: `apps/frontend/docs/features/inventory.md`

#frontend #inventory
