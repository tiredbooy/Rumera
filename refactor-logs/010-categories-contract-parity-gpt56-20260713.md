# Task 010: Categories Contract Parity

**Status:** Complete
**Date:** 2026-07-13

## What changed

- Rebuilt the frontend category contracts from the Go category models, handlers,
  tree builder, repository behavior, and database constraints.
- Added canonical `Category`, `CategoryTree`, `ProductCategory`, category input,
  and category list-query types with exact wire keys and optionality.
- Removed invented category timestamps and duplicate top-level/admin category
  declarations.
- Updated category consumers to use the owning domain and the backend's `title`
  field instead of the nonexistent `name` field.
- Corrected category list pagination and success-envelope type declarations
  without moving the APIs scheduled for later tasks.

## Files touched

- `apps/frontend/features/catalog/categories/types.ts`
- `apps/frontend/features/catalog/categories/api.ts`
- `apps/frontend/features/home/components/CategoryCard.tsx`
- `apps/frontend/features/home/components/CategoryGrid.tsx`
- `apps/frontend/features/admin/categories/components/CategoryForm.tsx`
- `apps/frontend/features/admin/categories/components/CategoryTable.tsx`
- `apps/frontend/features/admin/categories/types.ts` (removed)
- `apps/frontend/features/admin/products/components/ProductForm.tsx`
- `apps/frontend/features/admin/products/components/product-form/GeneralInfoSection.tsx`
- `apps/frontend/app/admin/categories/new/page.tsx`
- `apps/frontend/app/admin/categories/[id]/page.tsx`
- `apps/frontend/app/(storefront)/categories/page.tsx`
- `apps/frontend/app/admin/products/new/page.tsx`
- `apps/frontend/components/categories.ts`
- `apps/frontend/components/category.ts` (removed)
- `refactor-workstreams/gpt56-domain-refactor-20260713/TASKS.md`
- `refactor-workstreams/gpt56-domain-refactor-20260713/IN_PROGRESS.md`
- `refactor-workstreams/gpt56-domain-refactor-20260713/FINISHED.md`
- `refactor-logs/010-categories-contract-parity-gpt56-20260713.md`

## Verification

- Scoped ESLint completed with zero errors and three existing React
  Compiler/hooks warnings.
- Contract and import searches found no stale category response/request names,
  category-tree node duplicates, deleted top-level category imports, or category
  imports from deleted `lib/catalog/types`.
- `git diff --check` passed.
- Full TypeScript validation was rerun and remains blocked by the documented
  missing catalog modules and disabled admin client. No new category-contract
  failures appeared.

## Notes / follow-ups

- Tasks 027b, 029, and 038 own the remaining deleted category helper imports,
  category API extraction, and disabled admin-client removal respectively.
- `CategoryForm` has a pre-existing slug-effect dependency warning. It remains
  unchanged because fixing that interaction would alter behavior outside this
  contract task.
- No Go source changes were needed.
