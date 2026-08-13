---
tags: [backend, inventory, commerce]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 03 Backend]]


# Inventory Backend

Stock on hand, committed stock, reorder points, movement ledger, and order
lifecycle reserve / release / deduct.

## Package (feature slice)

```text
apps/backend/internal/features/inventory/
  doc.go → routes.go → handler.go → service.go
  → repository.go → movement_repository.go → model.go → mapper.go
```

| Surface | Paths |
|---------|--------|
| Admin | `GET /admin/inventory`, low-stock, movements, variant stock adjust/reorder |

**List wire (PH-020a):** SQL joins `products.weight` → response `weight` +
`missing_weight` (null/≤0). Documented in `api/inventory.md`.

Downward consumers (not HTTP):

- **Orders** — `ReserveForOrderTx` / `ReleaseForOrder`
- **Payments** — `DeductForOrderTx` on confirm
- **Cart / variant / alerts** — `Repository` for availability / EnsureForVariant

## Related

[[Inventory]] · [[Cart and Checkout]] · [[Orders]] · [[Payments Backend]] · [[ADR Backend feature packages]] · [[Backend package map]]

#backend #inventory
