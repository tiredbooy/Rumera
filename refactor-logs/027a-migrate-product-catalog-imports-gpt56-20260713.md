# Task 027a: Migrate Product Catalog Imports

**Status:** Complete
**Date:** 2026-07-13

## What changed

- Moved error-safe, one-hour ISR product list/detail/slug/static-param reads into
  the product domain API using `apiFetch`.
- Migrated all six sitemap, storefront, product-detail, and journal consumers from
  deleted `lib/catalog/products`.
- Preserved prior fallback, caching, lookup, and rendering behavior.
- Added no compatibility shim or deleted-module replacement.

## Files touched

- `apps/frontend/features/catalog/products/api.ts`
- `apps/frontend/app/sitemap.ts`
- `apps/frontend/app/(storefront)/search/page.tsx`
- `apps/frontend/app/(storefront)/categories/[category]/page.tsx`
- `apps/frontend/app/(storefront)/products/page.tsx`
- `apps/frontend/app/(storefront)/products/[slug]/page.tsx`
- `apps/frontend/app/(storefront)/journal/[slug]/page.tsx`
- `refactor-workstreams/gpt56-domain-refactor-20260713/TASKS.md`
- `refactor-workstreams/gpt56-domain-refactor-20260713/IN_PROGRESS.md`
- `refactor-workstreams/gpt56-domain-refactor-20260713/FINISHED.md`
- `refactor-logs/027a-migrate-product-catalog-imports-gpt56-20260713.md`

## Verification

- Scoped ESLint passed with zero errors and zero warnings.
- Search confirmed zero deleted product catalog imports.
- `git diff --check` passed.
- Full TypeScript no longer reports missing product-catalog errors; remaining
  failures belong to subsequent migration tasks.

## Notes / follow-ups

- Task 027b should restore category typing in shared list/search/sitemap pages.
- Task 027f owns deleted recommendation API imports.
