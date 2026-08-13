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
| Free customer wallet deposit | Gateway top-up / admin credit only |
| Fake `Begin/Commit` without threading `pgx.Tx` | `repo.WithTx(tx)` pattern (blog + recipes PH-010a) |
| Raw `go func()` for OTP/email/counters after handler | `pkg/async.Go` / `GoCtx` (PH-013a) — panic outside Gin Recovery kills the process |
| Generic-only `INTERNAL_ERROR` / empty message for known stock/coupon/funds | Stable `code` + actionable `message` via httpx / apperr (PH-012c) · [[Error model]] |
| Map wallet shortfall to `PAYMENT_FAILED` | `INSUFFICIENT_FUNDS` (fixed PH-012c) |
| Import cycles between features | Local interfaces at boundaries |
| Add business handlers to `internal/handlers` | Own feature package + `Register*` |
| Money POST without idempotency plan | [[Playbook Document a change]] + [[ADR Idempotency platform]] + [[Playbook Debug Idempotency]] |
| Skip dual-track docs on money/auth/stock | [[Playbook Document a change]] |
| Delete ProcessEnv keys in tests | Snapshot restore / pass env object |
| Invent multi-currency / multi-warehouse / crypto now | Deferred — [[Known gaps]] |
| Treat box subscription as Netflix streaming | E-com box model only |

Related: [[Agent onboarding]] · [[Money and stock rules]] · [[Decisions MOC]]

#architecture #quality
