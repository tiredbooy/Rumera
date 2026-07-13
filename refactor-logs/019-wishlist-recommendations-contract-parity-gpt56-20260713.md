# Task 019: Wishlist And Recommendations Contract Parity

**Status:** Complete
**Date:** 2026-07-13

## What changed

- Added canonical wishlist item, wishlist, add-item result, membership,
  recommendation card/query, interaction, affinity, and profile contracts.
- Preserved add-item `{ wishlist_id }` and optional unhydrated wishlist options.
- Removed local/deleted wishlist and recommendation type dependencies from central
  and account hooks.
- Migrated wishlist and recommendation consumers to canonical `product_id`,
  optional slug, and complete recommendation price/score fields.

## Files touched

- `apps/frontend/features/wishlist/types.ts`
- `apps/frontend/features/recommendations/types.ts`
- `apps/frontend/lib/api/hooks.ts`
- `apps/frontend/lib/api/account-hooks.ts`
- `apps/frontend/features/account/wishlist/components/wishlist-view.tsx`
- `apps/frontend/features/account/account/components/account-overview.tsx`
- `apps/frontend/features/catalog/products/components/recommendation-rail.tsx`
- `refactor-workstreams/gpt56-domain-refactor-20260713/TASKS.md`
- `refactor-workstreams/gpt56-domain-refactor-20260713/FINISHED.md`
- `refactor-logs/019-wishlist-recommendations-contract-parity-gpt56-20260713.md`

## Verification

- Scoped ESLint passed with zero errors and zero warnings.
- Searches confirmed one wishlist/recommendation contract owner, no stale local
  recommendation type, and exact add-item/options declarations.
- `git diff --check` passed.
- Full TypeScript validation remains blocked by documented deleted catalog/admin
  modules. No new Task 019 failures appeared.

## Notes / follow-ups

- The account recommendation hook points to an unsupported `/recommendations`
  route; Task 033c owns replacement with the valid recommendation APIs.
- Wishlist options remain unhydrated, and empty item slices may serialize as null
  despite backend documentation promising an array.
- Tasks 027f, 033b, and 033c own remaining function-import and API migration work.
