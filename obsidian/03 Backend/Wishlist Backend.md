---
tags: [backend, wishlist, account]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 03 Backend]]


# Wishlist Backend

One wishlist per customer (get-or-create). Items are product variants with catalogue join for title, price, stock, image. `GetItems` is capped at `LIMIT 100` (newest first) and hydrates line `options` from [[Catalogue]] variant option values in one query (`product_variants_options` → `option_values` → `option_types`, `ANY($1)`). Empty/omitted when the variant has none.

## Package (feature slice)

```text
apps/backend/internal/features/wishlist/
  doc.go → routes.go → handler.go → service.go → repository.go → model.go → mapper.go
```

Mounted via `wishlist.RegisterCustomer` from `internal/routes/routes.go`.

## HTTP

API guide: `apps/backend/docs/api/wishlist.md`

| Method | Path |
|--------|------|
| GET | `/api/v1/wishlist` |
| DELETE | `/api/v1/wishlist` |
| POST | `/api/v1/wishlist/items` |
| DELETE | `/api/v1/wishlist/items/:id` |
| GET | `/api/v1/wishlist/has/:variantID` |

## Related

[[Account Domain]] · [[Wishlist and Reviews]] · [[Catalogue]] · [[ADR Backend feature packages]] · [[Backend package map]]

#backend #wishlist
