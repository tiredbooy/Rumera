---
tags: [backend, hero, content]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 03 Backend]]


# Hero Slides Backend

Home-page carousel slides (public active list + admin CRUD/reorder).

## Package (feature slice)

```text
apps/backend/internal/features/hero/
  doc.go → routes.go → handler.go → service.go → validation.go → repository.go → model.go → mapper.go
```

| Method | Path |
|--------|------|
| GET | `/api/v1/hero-slides` (public, active only) |
| GET/POST | `/api/v1/admin/hero-slides` |
| PUT | `/api/v1/admin/hero-slides/order` |
| GET/PATCH/DELETE | `/api/v1/admin/hero-slides/:id` |

Image cleanup uses `MediaCleaner` (implemented by `services.MediaLifecycleService` until media migrates).

## Related

[[Hero and Home]] · [[ADR Backend feature packages]] · [[Backend package map]] · [[Media Pipeline]]

#backend #hero
