# Task 030b: Split Tag APIs By Public/Admin Caller

**Status:** Complete
**Date:** 2026-07-13

## What changed

- Kept public tag reads in the catalog domain with business-language names.
- Moved tag CRUD/product assignment to the admin domain.
- Corrected tag CRUD routes to `/admin/tags`.
- Typed delete/attach/sync/detach as backend `204`/`Promise<void>` operations.
- Corrected product tag reads to full `Tag[]` responses.

## Files touched

- `apps/frontend/features/catalog/tags/api/public.ts`
- `apps/frontend/features/catalog/tags/api/admin.ts` (removed)
- `apps/frontend/features/admin/tags/api.ts`
- `refactor-workstreams/gpt56-domain-refactor-20260713/TASKS.md`
- `refactor-workstreams/gpt56-domain-refactor-20260713/IN_PROGRESS.md`
- `refactor-workstreams/gpt56-domain-refactor-20260713/FINISHED.md`
- `refactor-logs/030b-split-tag-apis-gpt56-20260713.md`

## Verification

- Combined scoped ESLint: zero errors, one existing BrandForm warning.
- Admin route prefixes and all five no-content contracts match Go handlers.
- Full TypeScript has no brand/tag API failures.
- `git diff --check` passed.
