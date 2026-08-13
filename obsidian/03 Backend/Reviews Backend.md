---
tags: [backend, reviews, content]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 03 Backend]]


# Reviews Backend

Product reviews: ratings, reactions, images, verified-purchase badge, admin moderation.

## Package (feature slice)

```text
apps/backend/internal/features/reviews/
  doc.go → routes.go → handler.go → service.go → repository.go → image_repository.go → model.go → mapper.go
```

| Surface | Paths |
|---------|--------|
| Public | `GET /products/:id/reviews`, `/summary`, `GET /reviews/:id` (approved) |
| Customer | mine, pending, create/update/delete, react, images |
| Admin | list, status patch |

## Related

[[Wishlist and Reviews]] · [[ADR Backend feature packages]] · [[Backend package map]] · [[Catalogue]]

#backend #reviews
