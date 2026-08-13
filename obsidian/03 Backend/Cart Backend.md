---
tags: [backend, cart, commerce]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 03 Backend]]


# Cart Backend

Customer shopping cart: get/add/update/remove/clear, bulk add (e.g. recipe
ingredients), price snapshot at add-time, stock availability checks.

## Package (feature slice)

```text
apps/backend/internal/features/cart/
  doc.go → routes.go → handler.go → service.go → repository.go → model.go
```

| Surface | Paths |
|---------|--------|
| Customer | `GET/DELETE /cart`, `POST/PATCH/DELETE /cart/items`, bulk add |

Downward consumers:

- **Orders** — `cart.Repository` GetOrCreate / GetItems / Clear under tx
- **Inventory** — stock availability via `inventory.Repository`
- **Catalog** — variant lookup via `repositories.VariantRepository` until catalog migrates

## Related

[[Cart and Checkout]] · [[Inventory Backend]] · [[Orders]] · [[ADR Backend feature packages]]

#backend #cart
