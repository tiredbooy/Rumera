# Task 042e: Move Header Actions And Site-Header Composition

**Status:** Complete
**Date:** 2026-07-14

## What changed

- Moved all remaining header presentation into `features/storefront/navigation`.
- Made `SiteHeader` a Server Component with a focused scroll-aware client wrapper.
- Centralized primary links, announcement copy, and product-menu promotion data.
- Updated storefront layout imports and removed obsolete top-level components.
- Corrected client category-tree fetching through the allowlisted public BFF.
- Closed keyboard, focus, RTL, and responsive-overflow findings from independent
  review.

## Files touched

- `apps/frontend/app/(storefront)/layout.tsx`
- `apps/frontend/app/api/public/[...path]/route.ts`
- `apps/frontend/features/catalog/categories/**`
- `apps/frontend/features/storefront/navigation/**`
- Top-level header/navigation components under `apps/frontend/components/`
  (removed)
- Workstream trackers and Task Group 042 logs.

## Verification

- Full typecheck passed.
- Full lint passed with zero errors and 12 unrelated existing warnings.
- Tests passed with no test files present.
- Production build passed.
- Browser viewport and interaction checks passed at 320, 375, 768, 1024, and
  1440px.
- Independent final review found no remaining Task Group 042 defects.
- Stale-import search and `git diff --check` passed.
