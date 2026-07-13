# Task 012: Tags Contract Parity

**Status:** Complete
**Date:** 2026-07-13

## What changed

- Rebuilt full tag, tag mutation input, tag list-query, and reduced product-tag
  contracts from the active Go HTTP surface.
- Removed the nonexistent frontend tag slug and restored exact snake_case
  `created_at` and `updated_at` timestamps.
- Moved the reduced `{ id, title }` product tag into the tag domain.
- Removed every local `AdminTag` declaration from product and recipe routes and
  forms in favor of canonical `Tag`.
- Corrected the paginated public tag-list type and its active consumer.

## Files touched

- `apps/frontend/features/catalog/tags/types.ts`
- `apps/frontend/features/catalog/tags/api/public.ts`
- `apps/frontend/features/catalog/tags/api/admin.ts`
- `apps/frontend/features/catalog/products/types.ts`
- `apps/frontend/features/catalog/products/api.ts`
- `apps/frontend/features/admin/products/components/ProductForm.tsx`
- `apps/frontend/features/admin/products/components/product-form/SeoSection.tsx`
- `apps/frontend/features/admin/products/components/product-form/TagSelector.tsx`
- `apps/frontend/features/admin/recipes/components/RecipeForm.tsx`
- `apps/frontend/app/admin/products/page.tsx`
- `apps/frontend/app/admin/products/new/page.tsx`
- `apps/frontend/app/admin/products/[id]/page.tsx`
- `apps/frontend/app/admin/recipes/new/page.tsx`
- `apps/frontend/app/admin/recipes/[id]/page.tsx`
- `refactor-workstreams/gpt56-domain-refactor-20260713/TASKS.md`
- `refactor-workstreams/gpt56-domain-refactor-20260713/IN_PROGRESS.md`
- `refactor-workstreams/gpt56-domain-refactor-20260713/FINISHED.md`
- `refactor-logs/012-tags-contract-parity-gpt56-20260713.md`

## Verification

- Scoped ESLint completed with zero errors and two existing React Compiler
  warnings.
- Searches found no remaining local `AdminTag`, stale list-query name, tag slug,
  camelCase tag timestamp, or duplicate reduced product-tag declaration.
- `git diff --check` passed.
- Full TypeScript validation remains blocked by the documented deleted catalog
  modules and disabled admin client. No new tag-contract failures appeared.

## Notes / follow-ups

- Task 030b owns tag API extraction and final admin route verification.
- The database schema still requires a tag slug even though the current Go model,
  requests, repository writes, and HTTP contract omit it. Backend owners need to
  reconcile that mismatch before tag creation can be trusted.
- Task 011 is being handled by another agent as directed by the user.
