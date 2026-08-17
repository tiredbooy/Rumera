---
tags: [backend, recipes, content, commerce]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 03 Backend]]


# Recipes Backend

Cocktail recipes with publishing workflow, SEO (schema.org JSON-LD), and
**shoppable products** (variant links → storefront upsell).

## Package (feature slice)

```text
apps/backend/internal/features/recipes/
  doc.go → routes.go → handler.go → service.go → repository.go → model.go → mapper.go
```

| Surface | Paths |
|---------|--------|
| Public | `GET /recipes`, `/recipes/featured`, `/recipes/sitemap`, `/recipes/:slug`, `/recipes/:slug/related`, `/products/:id/recipes` |
| Admin | `GET/POST/PATCH/DELETE /admin/recipes` |

- Public detail: Redis cache + singleflight (TTL 120s); write invalidates by slug
- View count: async off the request path
- Image cleanup via `MediaCleaner` (MediaLifecycleService until media migrates)
- **Atomic writes (PH-010a):** Create/Update open a DB TX, `repo.WithTx(tx)`, then
  write parent + ingredients + products + tags on that TX. No more pool writes
  inside a fake Begin/Commit. Rollback tested via `service_tx_test.go`.
- **Slug uniqueness (PR-070f):** Create/Update take `pg_advisory_xact_lock` (same
  as journal). `uniqueRecipeSlug` must not treat a lookup error as “free”.
  Postgres `23505` on `recipes.slug` maps to `409 CONFLICT`, not `500`.
- **Publish schedule (PR-070g):** public list / featured / related / sitemap /
  `GET /recipes/:slug` / product cross-sell require `published_at IS NULL OR
  published_at <= NOW()`. Admin list/detail unchanged.
- **Search (PR-070h):** list `search=` matches `rumera_search_normalize(title|excerpt)`
  so Arabic-yeh/kaf match Persian titles (same as products).

## Related

[[Recipes and Journal]] · [[ADR Backend feature packages]] · [[Backend package map]] · [[Media Pipeline]] · [[Catalogue]] · [[Pitfalls and anti-patterns]]

#backend #recipes
