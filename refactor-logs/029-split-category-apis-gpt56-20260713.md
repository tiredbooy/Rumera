# Task 029: Split Category APIs By Public/Admin Caller

**Status:** Complete
**Date:** 2026-07-13

## What changed

- Split category calls into public server, admin server, and admin browser APIs.
- Routed all server calls through `apiFetch`.
- Preserved caching, pagination, response unwrapping, errors, and `204` deletion.
- Migrated category admin pages/forms/table from global admin-client calls.
- Removed obsolete mixed/raw category API functions.

## Files touched

- `apps/frontend/features/catalog/categories/api.ts`
- `apps/frontend/features/admin/categories/api.ts`
- `apps/frontend/features/admin/categories/client.ts`
- `apps/frontend/features/admin/categories/components/CategoryForm.tsx`
- `apps/frontend/features/admin/categories/components/CategoryTable.tsx`
- `apps/frontend/app/admin/categories/new/page.tsx`
- `apps/frontend/app/admin/categories/[id]/page.tsx`
- `apps/frontend/app/(storefront)/page.tsx`
- `refactor-workstreams/gpt56-domain-refactor-20260713/TASKS.md`
- `refactor-workstreams/gpt56-domain-refactor-20260713/IN_PROGRESS.md`
- `refactor-workstreams/gpt56-domain-refactor-20260713/FINISHED.md`
- `refactor-logs/029-split-category-apis-gpt56-20260713.md`

## Verification

- Scoped ESLint: zero errors, two existing CategoryForm warnings.
- No old category transport names, raw server fetches, or global admin-client
  category imports remain.
- Full TypeScript has no category API failures.
- `git diff --check` passed.
