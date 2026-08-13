---
tags: [backend, blog, content, journal]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 03 Backend]]


# Blog Backend

Journal posts and blog categories (public listing/slug + admin CMS).

## Package (feature slice)

```text
apps/backend/internal/features/blog/
  doc.go → routes.go → handler.go → service.go → repository.go → model.go → mapper.go
```

Single handler owns posts (`Service`) and categories (`CategoryService`).

| Surface | Paths |
|---------|--------|
| Public | `GET /blogs`, `GET /blogs/:slug`, `GET /blog-categories` |
| Admin | `GET/POST/PATCH/DELETE /admin/blogs`, category admin routes |

Media cleanup via `MediaCleaner` (MediaLifecycleService until media migrates).

**Atomic writes:** Create/Update use `repo.WithTx(tx)` so category/product/tag
assignments run on the same transaction (blog was already fixed; same pattern as
recipes PH-010a).

## Related

[[Recipes and Journal]] · [[ADR Backend feature packages]] · [[Backend package map]] · [[Media Pipeline]] · [[Pitfalls and anti-patterns]]

#backend #blog
