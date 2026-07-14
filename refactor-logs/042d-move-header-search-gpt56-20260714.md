# Task 042d: Move Header Search

**Status:** Complete
**Date:** 2026-07-14

## What changed

- Moved header search into storefront navigation ownership.
- Preserved inline/drawer variants and encoded search routing.
- Added explicit labels, a named query field, clear-to-input focus restoration,
  focus styling, and touch-sized icon controls.

## Files touched

- `apps/frontend/features/storefront/navigation/components/header-search.tsx`
- `apps/frontend/features/storefront/navigation/components/mobile-nav-drawer.tsx`
- `apps/frontend/components/HeaderSearch.tsx` (removed)
- `apps/frontend/components/site-header.tsx`
- Workstream trackers and this log.

## Verification

- Scoped ESLint and full typecheck passed.
- Stale-import search and `git diff --check` passed.
- Cumulative group lint, tests, production build, five viewport checks, and
  keyboard verification passed after Task 042e.
