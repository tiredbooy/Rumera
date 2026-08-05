---
tags: [architecture, quality]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 02 Architecture]]


# Pitfalls and anti-patterns

| Don’t | Do instead |
|-------|------------|
| Concatenate `API_URL + media path` in components | [[Media and Cache FE]] resolver |
| Use `stock_on_hand` for “can buy” | [[Term available_stock]] |
| Trust client role / price / stock | [[Backend API]] + [[RBAC]] |
| Put catalogue types in `lib/catalog` | [[Frontend Domain Map]] |
| Soft-fail checkout errors | Surface API errors |
| Assume Meili is live | [[Search Backend]] ILIKE |
| Confirm payment outside webhook path | [[Payments Backend]] |
| Reserve stock after order commit | Same TX as CreateOrder |
| Delete ProcessEnv keys in tests | Snapshot restore / pass env object |
| Edit Playwright files while Codex owns 062 | Stay on your task |

Related: [[Agent onboarding]] · [[Money and stock rules]] · [[Decisions MOC]]

#architecture #quality
