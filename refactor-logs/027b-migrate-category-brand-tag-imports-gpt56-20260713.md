# Task 027b: Migrate Category, Brand, And Tag Catalog Imports

**Status:** Complete
**Date:** 2026-07-13

## What changed

- Added domain-owned, error-safe ISR category list/slug/tree reads.
- Migrated all six deleted category-helper consumers and one stale category type
  import.
- Updated storefront category projections from `name` to backend `title`.
- Confirmed no deleted brand or tag imports remained.
- Added no compatibility shim.

## Files touched

- `apps/frontend/features/catalog/categories/api.ts`
- `apps/frontend/app/sitemap.ts`
- `apps/frontend/app/(storefront)/layout.tsx`
- `apps/frontend/app/(storefront)/search/page.tsx`
- `apps/frontend/app/(storefront)/products/page.tsx`
- `apps/frontend/app/(storefront)/categories/page.tsx`
- `apps/frontend/app/(storefront)/categories/[category]/page.tsx`
- `apps/frontend/app/admin/products/[id]/page.tsx`
- `refactor-workstreams/gpt56-domain-refactor-20260713/TASKS.md`
- `refactor-workstreams/gpt56-domain-refactor-20260713/IN_PROGRESS.md`
- `refactor-workstreams/gpt56-domain-refactor-20260713/FINISHED.md`
- `refactor-logs/027b-migrate-category-brand-tag-imports-gpt56-20260713.md`

## Verification

- Scoped ESLint passed with zero errors and zero warnings.
- Searches confirmed zero deleted category/brand/tag imports.
- `git diff --check` passed.
- Full TypeScript no longer reports category catalog failures.

## Notes / follow-ups

- Task 027c owns order/label imports; Task 029 owns category API consolidation.
