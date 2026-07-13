# Task 015: Cart Contract Parity

**Status:** Complete
**Date:** 2026-07-13

## What changed

- Added canonical cart item, summary, cart, mutation-input, skipped-item, and
  bulk-add result contracts in `features/cart/types.ts`.
- Included exact bulk-add skipped variant IDs and reason values.
- Migrated central cart hooks from local/deleted declarations to domain types.
- Excluded server-managed `unit_price_snapshot` from frontend contracts and
  preserved checkout's displayed snapshotted price through `line_total`.
- Preserved all existing cart request, cache-update, and clear-cart behavior.

## Files touched

- `apps/frontend/features/cart/types.ts`
- `apps/frontend/lib/api/hooks.ts`
- `apps/frontend/features/checkout/components/checkout-flow.tsx`
- `refactor-workstreams/gpt56-domain-refactor-20260713/TASKS.md`
- `refactor-workstreams/gpt56-domain-refactor-20260713/FINISHED.md`
- `refactor-logs/015-cart-contract-parity-gpt56-20260713.md`

## Verification

- Scoped ESLint passed with zero errors and zero warnings.
- Searches confirmed one cart contract owner, exact bulk skip reasons, and no
  frontend snapshot or stale local bulk-result declarations.
- `git diff --check` passed.
- Full TypeScript validation remains blocked by documented deleted catalog/admin
  modules. No new cart-contract failures appeared.

## Notes / follow-ups

- Tasks 027e and 032b own remaining cart catalog imports and cart API/hook
  extraction respectively.
- The backend still leaks `unit_price_snapshot` in responses/docs and currently
  leaves required `discount_total` at zero.
- Task 014 continues independently under the shared active-task tracker.
