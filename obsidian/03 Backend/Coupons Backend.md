---
tags: [backend, coupons, commerce]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 03 Backend]]


# Coupons Backend

Discount coupons: admin CRUD, checkout validate preview, order redemption
(under row lock + usage recording).

## Package (feature slice)

```text
apps/backend/internal/features/coupons/
  doc.go → routes.go → handler.go → service.go → repository.go → usage_repository.go → model.go → mapper.go
```

| Surface | Paths |
|---------|--------|
| Customer | `POST /coupons/validate` |
| Admin | `GET/POST/PATCH/DELETE /admin/coupons` |

Orders depend downward on `coupons.Repository` / `UsageRepository` (not HTTP).

Shared `models.NullablePatch` lives in `models/nullable_patch.go` (extracted during this move).

## Related

[[Cart and Checkout]] · [[Orders]] · [[ADR Backend feature packages]] · [[Backend package map]]

#backend #coupons
