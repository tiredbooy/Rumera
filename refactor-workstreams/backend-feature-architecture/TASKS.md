# Backend Feature-Based Architecture Refactor

**Workstream ID:** `backend-feature-architecture-20260810`
**Created:** 2026-08-10
**Goal:** Move the Go API from horizontal layers (`handlers` / `services` /
`repositories` / `models` mixed by file) to **feature-based vertical slices**
without changing HTTP contracts, behaviour, or breaking the frontend.

**Completed history:** `FINISHED.md` (do not re-do those tasks).  
**Active claim:** `IN_PROGRESS.md` (at most one task).

## Non-negotiables

1. **Nothing breaks.** After every task: `go build ./...` and the scoped
   `go test` package set are green. Prefer full `go test ./...` when feasible.
2. **No API contract changes.** Paths, methods, status codes, JSON keys,
   error codes, auth requirements stay identical unless a later explicit task
   says otherwise.
3. **One feature (or tightly coupled pair) per task.** No mega-moves.
4. **No silent behaviour rewrites.** Refactor packaging only; fix bugs only
   when they block the move or compile/test.
5. **Import updates, not permanent shims.** Temporary re-exports only if a
   task documents them *and* a removal sub-task exists in the same epic.
6. **Wire graph stays explicit.** `bootstrap/container.go` remains the
   composition orchestrator; feature packages own `New`/`Wire` constructors.

## Target layout (locked — see CHARTER.md)

```
apps/backend/internal/
  platform/httpx/               # shared bind/validate/error helpers
  features/
    rbac/  users/  auth/  addresses/
    wallet/  wishlist/  loyalty/  referral/  giftcard/
    subscription/  alerts/  taste/          # flat account domains
    site_settings/  hero/  blog/  recipes/
    reviews/  recommendations/  coupons/  shipping/
    inventory/  cart/  payments/  orders/  media/
    catalog/{product,variant,option,category,brand,tag}   # umbrella
    analytics/
  routes/                       # composer
  bootstrap/  middlewares/  notifications/  analytics/
  handlers/                     # composition root only
  models/                       # shared cross-feature types only
```

**Decisions:** catalog = umbrella subpackages; account = flat packages;
each feature owns `Handler` + `Register*` routes + `wire.go` constructor.

Cross-feature imports are **downward only**. Cycles are a hard fail.

## Progress snapshot (as of BE-044) — PHASE 2 COMPLETE

**Migrated (see FINISHED.md):** BE-000…003, BE-010…032, BE-040–044  
→ Feature vertical slices complete; bootstrap orchestrates feature `New`/`Wire`;
empty layered packages removed; full unit + integration regression green.

**Still outside features (by design):**
`internal/analytics` capture queue, `internal/corn` jobs, slim `handlers`
composition root, shared `models`, `middlewares`, `notifications`, bootstrap.

## Remaining backlog

_(empty — Phase 2 complete. No further tasks in this workstream.)_

## Explicitly out of scope (this workstream)

- Frontend feature moves
- New RBAC enforcement product work (tracked separately as Task 082a in
  Refactor-Docs) — may *live* under `features/rbac` but behaviour changes
  need their own tasks
- Database schema redesign
- Microservice split
- Rewriting SQL or business rules “while we are here”
