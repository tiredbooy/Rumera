# Task 016: Shipping Contract Parity

**Status:** Complete
**Date:** 2026-07-13

## What changed

- Added canonical shipping method, zone, rate, admin mutation-input, list-query,
  and checkout-query contracts in `features/shipping/types.ts`.
- Modeled exact response optionality and nullable admin write inputs.
- Removed the duplicate admin shipping type module.
- Migrated the central shipping hook and checkout flow to the shipping domain.
- Preserved required `estimated_cost` and all existing UI/API behavior.

## Files touched

- `apps/frontend/features/shipping/types.ts`
- `apps/frontend/features/admin/shipping/types.ts` (removed)
- `apps/frontend/lib/api/hooks.ts`
- `apps/frontend/features/checkout/components/checkout-flow.tsx`
- `refactor-workstreams/gpt56-domain-refactor-20260713/TASKS.md`
- `refactor-workstreams/gpt56-domain-refactor-20260713/FINISHED.md`
- `refactor-logs/016-shipping-contract-parity-gpt56-20260713.md`

## Verification

- Scoped ESLint passed with zero errors and zero warnings.
- Searches confirmed one shipping contract owner, no stale admin shipping types,
  and no shipping imports from deleted catalog declarations.
- `git diff --check` passed.
- Full TypeScript validation remains blocked by documented deleted catalog/admin
  modules. No new shipping-contract failures appeared.

## Notes / follow-ups

- Backend `estimated_cost` remains zero because the response mapper never sets it,
  including on the available-checkout endpoint.
- The single-zone handler does not hydrate documented nested methods.
- Task 032c owns shipping API/hook extraction.
