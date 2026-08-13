---
tags: [backend, shipping, commerce]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 03 Backend]]


# Shipping Backend

Shipping zones, methods, and checkout rate estimation. Orders authorize a
selected method via `Service.AuthorizeCheckoutMethod` so quote preview and
persisted shipping amounts share one policy.

## Package (feature slice)

```text
apps/backend/internal/features/shipping/
  doc.go → routes.go → handler.go → service.go → validation.go
  → zone_repository.go → method_repository.go → model.go → mapper.go
```

| Surface | Paths |
|---------|--------|
| Public | `GET /shipping/zones`, zone detail, zone methods, method by id, `GET /shipping/available` |
| Admin | `POST/PATCH/DELETE /admin/shipping/zones`, method CRUD under zones |

Orders depend downward on `shipping.Service` (not HTTP). Coupons free-shipping
type zeroes cost in order creation separately.

## Related

[[Shipping and Coupons]] · [[Cart and Checkout]] · [[Orders]] · [[ADR Backend feature packages]] · [[Backend package map]]

#backend #shipping
