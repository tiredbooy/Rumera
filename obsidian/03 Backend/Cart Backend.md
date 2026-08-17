---
tags: [backend, cart, commerce]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 03 Backend]]


# Cart Backend

Customer shopping cart: get/add/update/remove/clear, bulk add (e.g. recipe
ingredients), price snapshot at add-time, stock availability checks.

**One cart per user.** `carts.user_id` is `UNIQUE NOT NULL`. Auth-only (no
guest cart). `GetOrCreate` requires that unique target — see
`migrations/main/20260816170000_carts_user_id_unique.sql`.

Unexpected repo/SQL errors are logged (`slog.Error` `op` + cause) then returned
as `apperr.ErrInternal`. Public 500 stays the generic `INTERNAL_ERROR` envelope
— no SQL in the body. Typed stock / not-found / unavailable mappings are
unchanged. See [[Error model]].

Add-to-cart looks up the parent product (`GetByIDForAdmin`) after the variant.
Missing parent → `PRODUCT_NOT_FOUND`. Inactive parent → `PRODUCT_UNAVAILABLE`
(same as an inactive variant) so a line cannot insert then vanish on
`GetItems`. Bulk add skips those lines as `unavailable`.

After a successful add (single or bulk), the service records
`add_to_cart` on [[Recommendations Backend]] (PR-050d). Recs failure is
logged and does not fail the cart write.

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
- **Coupons** — `CartBasketLookup` GetOrCreate / GetItems when validate omits IDs/subtotal (PR-020n; [[Coupons Backend]] · [[Playbook Debug Coupon validate]])
- **Inventory** — stock availability via `inventory.Repository`
- **Catalog** — variant lookup via `catalog/variant`; parent product via `catalog/product` `GetByIDForAdmin` ([[Catalogue]]); `GetItems` hydrates line `options` from [[Catalogue]] variant option values (one `ANY($1)` query)

## Related

[[Cart and Checkout]] · [[Inventory Backend]] · [[Orders]] · [[ADR Backend feature packages]]

#backend #cart
