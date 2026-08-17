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
| Customer | mine, pending (`LIMIT 100` each), create/update/delete, react, unlike (`DELETE /reviews/:id/react`), images |
| Admin | list, status patch (`product_title` + `product_slug` from `products`) |

Customer `POST /reviews` allows non-buyers. `HasPurchased` only stamps `verified_purchase`; missing purchase is **not** `403 ACCESS_DENIED`. Duplicate `(user_id, product_id)` is `409 CONFLICT`. New rows default `status=pending`. Success is `201`.

Customer `POST /reviews/:id/images` `image_url` is allow-listed: `https://` or origin-independent `/media/...` (rejects `javascript:`, `http:`).

Public `GET /products/:id/reviews` and `GET /reviews/:id` hydrate `review_images` in one batch query (not N+1).

Customer `DELETE /reviews/:id/react` undoes the caller's vote. No existing vote is still `204` (not `500`). Missing / unapproved review is `404`.

Admin `GET /admin/reviews` and `PATCH /admin/reviews/:id/status` hydrate `product_title` and `product_slug` from `products` (PR-063d). Public `ReviewResponse` stays `product_id` only. Contract: [reviews.md](../../apps/backend/docs/api/reviews.md).

## Related

[[Wishlist and Reviews]] · [[ADR Backend feature packages]] · [[Backend package map]] · [[Catalogue]]

#backend #reviews
