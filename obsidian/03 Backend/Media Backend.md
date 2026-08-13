---
tags: [backend, media]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 03 Backend]]


# Media Backend

Image upload, on-the-fly transforms (`GET /media/*key`), product gallery admin,
standalone/owner uploads, and lifecycle cleanup/reconciliation.

## Package (feature slice)

```text
apps/backend/internal/features/media/
  doc.go → routes.go → handler.go → service.go → lifecycle.go
  → key.go → validation.go → lifecycle_repository.go → content_repository.go
```

| Surface | Paths |
|---------|--------|
| Public | `GET /media/*key` (transform) |
| Admin | product images under `/admin/products/:id/images*`, `/admin/uploads*` |

Product image **rows** still use `models.ProductImage` + product image repository
(until catalog migrates). Content features (hero/blog/recipes) use `MediaCleaner`
satisfied by `LifecycleService`.

## Related

[[Media Pipeline]] · [[Catalogue]] · [[Hero Slides Backend]] · [[ADR Backend feature packages]]

#backend #media
