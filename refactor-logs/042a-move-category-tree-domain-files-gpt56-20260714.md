# Task 042a: Move Category Tree Hook And Domain Files

**Status:** Complete
**Date:** 2026-07-14

## What changed

- Moved `useCategoryTree` into `features/catalog/categories/hooks.ts`.
- Added a category-domain browser fetcher through the allowlisted public BFF so
  the client hook does not import the server-only category transport.
- Removed duplicate `components/categories.ts` and the old hook module.

## Files touched

- `apps/frontend/features/catalog/categories/hooks.ts`
- `apps/frontend/features/catalog/categories/client.ts`
- `apps/frontend/app/api/public/[...path]/route.ts`
- `apps/frontend/components/useCategoryTree.ts` (removed)
- `apps/frontend/components/categories.ts` (removed)
- Workstream trackers and this log.

## Verification

- Scoped ESLint passed.
- Full frontend typecheck passed.
- Stale-import search and `git diff --check` passed.
- Cumulative group lint, tests, production build, five viewport checks, and
  keyboard verification passed after Task 042e.
