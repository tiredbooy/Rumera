# Task 042b: Move Product Mega Menu

**Status:** Complete
**Date:** 2026-07-14

## What changed

- Moved the desktop product menu to the category domain.
- Added slug-safe direct category links and persistent all-products navigation.
- Added reusable category imagery with a deliberate fallback.
- Removed the unsupported discount-sort link.
- Added outside-click dismissal, Escape focus restoration, focus styling,
  reduced-motion handling, a useful empty state, roving category tabs, and
  collision-safe viewport positioning.

## Files touched

- `apps/frontend/features/catalog/categories/components/product-mega-menu.tsx`
- `apps/frontend/features/catalog/categories/components/category-thumbnail.tsx`
- `apps/frontend/components/ProductMegaMenu.tsx` (removed)
- `apps/frontend/components/site-header.tsx`
- Workstream trackers and this log.

## Verification

- Scoped ESLint and full typecheck passed.
- Stale-import and unsupported-route searches passed.
- `git diff --check` passed.
- Cumulative group lint, tests, production build, five viewport checks, and
  keyboard verification passed after Task 042e.
