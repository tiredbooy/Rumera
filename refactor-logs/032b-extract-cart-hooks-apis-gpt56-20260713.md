# Task 032b: Extract Cart Hooks And APIs

**Status:** Complete
**Date:** 2026-07-13

- Added cart-domain request functions and six hooks.
- Migrated all consumers and removed central definitions.
- Preserved query keys, cache seeding, invalidation, payloads, and `204` behavior.
- Scoped ESLint passed; no central cart hooks remain.

## Files touched

- `apps/frontend/features/cart/api.ts`
- `apps/frontend/lib/api/hooks.ts`
- `apps/frontend/features/cart/components/cart-button.tsx`
- `apps/frontend/features/cart/components/cart-view.tsx`
- `apps/frontend/features/cart/components/cart-lines.tsx`
- `apps/frontend/features/catalog/products/components/add-to-cart-button.tsx`
- `apps/frontend/features/recipes/components/add-all-button.tsx`
- `apps/frontend/features/account/wishlist/components/wishlist-view.tsx`
- `apps/frontend/features/account/orders/components/OrderDetail.tsx`
- `apps/frontend/features/checkout/components/checkout-flow.tsx`
- `refactor-workstreams/gpt56-domain-refactor-20260713/TASKS.md`
- `refactor-workstreams/gpt56-domain-refactor-20260713/IN_PROGRESS_TASK_032B_GPT56.md` (removed)
- `refactor-workstreams/gpt56-domain-refactor-20260713/FINISHED.md`
- `refactor-logs/032b-extract-cart-hooks-apis-gpt56-20260713.md`
