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

**Schedule (PR-070g):** public list/detail require `status=published` **and**
`published_at IS NULL OR published_at <= NOW()`. A future stamp is a schedule,
not a leak. Admin list/detail omit that window. Depth:
[blog.md](../../apps/backend/docs/api/blog.md). Journey: [[Journey Read journal]].

**Search (PR-070h):** list `search=` matches `rumera_search_normalize(title|excerpt)`
so Arabic-yeh/kaf match Persian titles (same as products).

Media cleanup via `MediaCleaner` (MediaLifecycleService until media migrates).

**Atomic writes:** Create/Update use `repo.WithTx(tx)` so category/product/tag
assignments run on the same transaction (blog was already fixed; same pattern as
recipes PH-010a).

## Related

[[Recipes and Journal]] · [[ADR Backend feature packages]] · [[Backend package map]] · [[Media Pipeline]] · [[Pitfalls and anti-patterns]]

#backend #blog
