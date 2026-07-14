# Task 042c: Move Mobile Category Drawer

**Status:** Complete
**Date:** 2026-07-14

## What changed

- Moved mobile navigation to the storefront navigation feature.
- Added shared slug-safe category URL generation.
- Reused canonical category thumbnails and fallbacks.
- Preserved drill-down while adding explicit back/current/all-product actions,
  empty states, level focus restoration, RTL-safe title spacing, focus styles,
  and touch-sized controls.

## Files touched

- `apps/frontend/features/storefront/navigation/components/mobile-nav-drawer.tsx`
- `apps/frontend/features/catalog/categories/utils.ts`
- `apps/frontend/features/catalog/categories/components/product-mega-menu.tsx`
- `apps/frontend/components/MobileNavDrawer.tsx` (removed)
- `apps/frontend/components/site-header.tsx`
- Workstream trackers and this log.

## Verification

- Scoped ESLint and full typecheck passed.
- Stale-import and unsafe-link searches passed.
- `git diff --check` passed.
- Cumulative group lint, tests, production build, five viewport checks, and
  keyboard verification passed after Task 042e.
