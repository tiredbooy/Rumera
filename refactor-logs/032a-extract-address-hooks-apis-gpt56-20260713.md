# Task 032a: Extract Address Hooks And APIs

**Status:** Complete
**Date:** 2026-07-13

- Added `features/addresses/api.ts` with request functions and five hooks.
- Migrated all consumers and removed central hook definitions.
- Preserved query keys, invalidation timing, errors, envelopes, and `204` results.
- Scoped ESLint passed; central stale-definition search returned zero matches.

## Files touched

- `apps/frontend/features/addresses/api.ts`
- `apps/frontend/features/account/addresses/components/addresses-view.tsx`
- `apps/frontend/features/account/account/components/account-overview.tsx`
- `apps/frontend/features/checkout/components/add-address-form.tsx`
- `apps/frontend/features/checkout/components/checkout-flow.tsx`
- `apps/frontend/features/subscriptions/components/subscriptions-view.tsx`
- `apps/frontend/lib/api/hooks.ts`
- `apps/frontend/lib/api/account-hooks.ts`
- `refactor-workstreams/gpt56-domain-refactor-20260713/TASKS.md`
- `refactor-workstreams/gpt56-domain-refactor-20260713/IN_PROGRESS_TASK_032A_GPT56.md` (removed)
- `refactor-workstreams/gpt56-domain-refactor-20260713/FINISHED.md`
- `refactor-logs/032a-extract-address-hooks-apis-gpt56-20260713.md`
