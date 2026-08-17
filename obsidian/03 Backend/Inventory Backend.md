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
  → repository.go → reservation.go → movement_repository.go → model.go → mapper.go
```

| Surface | Paths |
|---------|--------|
| Admin | `GET /admin/inventory`, low-stock, movements, variant stock adjust/reorder |

List, low-stock, movements, and per-variant movements are `{results, pagination}`
(default `limit` 20, max 100). Low-stock defaults to `available_stock asc`.

**List wire (PH-020a):** SQL joins `products.weight` → response `weight` +
`missing_weight` (null/≤0). Documented in `api/inventory.md`.

Downward consumers (not HTTP):

- **Orders** — `ReserveForOrderTx` / `ReleaseForOrder`
- **Payments** — `DeductForOrderTx` on confirm; webhook fail → `ReleaseForOrder` after order `payment_failed`
- **Cart / variant / alerts** — `Repository` for availability / EnsureForVariant
- **Catalogue product writes** — package-level `inventory.EnsureForVariantTx` from editor `SaveAggregate` and legacy `insertVariantTx` (same TX as the variant INSERT; PR-010a). Standalone [[Catalogue]] variant create still uses `Repository.EnsureForVariant`.

**Per-order hold (PR-020b):** `inventory_reservations` binds committed units to
`(order_id, variant)`. Release/deduct only move `committed_stock` while that
row is `active`. Re-release and late deduct after fail do not steal another
order’s pool.
**Business sentinels (PR-020q):** `isBusinessError` uses `errors.Is` so wrapped `%w` stock / not-found / invalid-state errors stay mapped (not 500).

## Related

[[Inventory]] · [[Cart and Checkout]] · [[Orders]] · [[Payments Backend]] · [[ADR Backend feature packages]] · [[Backend package map]]

#backend #inventory
