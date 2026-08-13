---
tags: [backend, addresses, account]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 03 Backend]]


# Addresses Backend

Customer shipping addresses (own addresses only; ownership enforced in SQL).

## Package (feature slice)

```text
apps/backend/internal/features/addresses/
  doc.go → routes.go → handler.go → service.go → repository.go → model.go
```

Mounted via `addresses.RegisterCustomer` from `internal/routes/routes.go` on the authenticated customer group.

## HTTP

See API guide: `apps/backend/docs/api/addresses.md`

| Method | Path |
|--------|------|
| POST | `/api/v1/addresses` |
| GET | `/api/v1/addresses` |
| GET | `/api/v1/addresses/:id` |
| PATCH | `/api/v1/addresses/:id` |
| DELETE | `/api/v1/addresses/:id` |
| POST | `/api/v1/addresses/:id/default` |

## Dependents

- [[Orders]] / order service uses `GetByID` (narrow lookup interface) for checkout **region** from `country`.

## Related

[[Account Domain]] · [[Cart and Checkout]] · [[ADR Backend feature packages]] · [[Backend package map]]

#backend #addresses
