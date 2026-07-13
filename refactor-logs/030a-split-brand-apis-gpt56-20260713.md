# Task 030a: Split Brand APIs By Public/Admin Caller

**Status:** Complete
**Date:** 2026-07-13

## What changed

- Consolidated public brand reads and home fallback in the catalog API.
- Reduced the admin server API to detail reads.
- Retained browser list/mutations with structured errors and `204` handling.
- Removed the duplicate raw home brand helper.

## Files touched

- `apps/frontend/features/catalog/brands/api.ts`
- `apps/frontend/features/admin/brands/api.ts`
- `apps/frontend/app/admin/brands/[id]/page.tsx`
- `apps/frontend/app/(storefront)/page.tsx`
- `apps/frontend/lib/home/brands.ts` (removed)
- `refactor-workstreams/gpt56-domain-refactor-20260713/TASKS.md`
- `refactor-workstreams/gpt56-domain-refactor-20260713/IN_PROGRESS.md`
- `refactor-workstreams/gpt56-domain-refactor-20260713/FINISHED.md`
- `refactor-logs/030a-split-brand-apis-gpt56-20260713.md`

## Verification

- Scoped ESLint: zero errors, one existing BrandForm warning.
- No stale brand API imports remain.
- `git diff --check` passed.
