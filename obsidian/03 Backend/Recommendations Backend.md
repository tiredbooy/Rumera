---
tags: [backend, recommendations, personalization]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 03 Backend]]


# Recommendations Backend

Product carousels and personalization: trending, similar, FBT, for-you,
interactions, affinity profiles, admin ops stats.

## Package (feature slice)

```text
apps/backend/internal/features/recommendations/
  doc.go → routes.go → handler.go → service.go → repository.go → model.go
```

| Surface | Paths |
|---------|--------|
| Public | trending, similar, frequently-bought-together |
| Customer | for-you, interactions, profile get/recompute |
| Admin | ops stats |

Cron: `internal/corn` `RecommendationRefreshJob` → `Service.RefreshActiveProfiles`.

## Related

[[Recommendations]] · [[ADR Backend feature packages]] · [[Backend package map]] · [[Catalogue]] · [[Processes and Jobs]]

#backend #recommendations
