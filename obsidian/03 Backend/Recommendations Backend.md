---
tags: [backend, recommendations, personalization]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 03 Backend]]


# Recommendations Backend

Product carousels and personalization: trending, similar, FBT, for-you,
interactions, affinity profiles, admin ops stats.

`GET /recommendations/for-you` overlays the caller's [[Taste Profile Backend]]
quiz (categories → catalogue ids including children; flavor/occasions → tags)
onto the behavioural affinity profile at serve time. No quiz or unmatched
names → previous behaviour (profile, else trending). Quiz prefs are not
persisted on `user_recommendation_profiles`.

**PR-050d:** `RecordPurchasesForOrder` is called from [[Payments Backend]]
Confirm (paid order only). Cart add calls `RecordInteraction(add_to_cart)`.
**PR-058a:** unknown `product_id` on `POST /recommendations/interactions`
is 404 (`ProductExists` + `apperr.ErrNotFound`), not a FK 500. Query
failures are returned, not swallowed as empty success. Depth:
[recommendations.md](../../apps/backend/docs/api/recommendations.md).

## Package (feature slice)

```text
apps/backend/internal/features/recommendations/
  doc.go → routes.go → handler.go → service.go → blend.go → repository.go → model.go
```

| Surface | Paths |
|---------|--------|
| Public | trending, similar, frequently-bought-together |
| Customer | for-you, interactions, profile get/recompute |
| Admin | ops stats |

Cron: `internal/corn` `RecommendationRefreshJob` → `Service.RefreshActiveProfiles`.

## Related

[[Recommendations]] · [[Taste Profile Backend]] · [[ADR Backend feature packages]] · [[Backend package map]] · [[Catalogue]] · [[Processes and Jobs]]

#backend #recommendations
