# Task Group 035: Wallet And Small Account-Domain APIs

**Status:** Complete
**Date:** 2026-07-13

## Domains

- Wallet: domain API/hooks/keys/types, wallet view, account overview.
- Payments: admin server/browser APIs, hooks, keys, exact transaction contracts.
- Loyalty: API/hooks/keys/types and rewards view.
- Gift cards: account/admin APIs, hooks/types, wallet redemption component.
- Subscriptions: API/hooks/keys/types and account view.
- Referrals: API/hooks/keys/types, referral card and tracker.
- Taste profile: API/hooks/keys/types/options and quiz.
- Product alerts: API/hooks/keys/types and product alert consumer.

## Files touched

- `apps/frontend/features/wallet/**`
- `apps/frontend/features/payments/**`
- `apps/frontend/features/loyalty/**`
- `apps/frontend/features/gift-cards/**`
- `apps/frontend/features/subscriptions/**`
- `apps/frontend/features/referral/**`
- `apps/frontend/features/taste/**`
- `apps/frontend/features/product-alerts/**`
- `apps/frontend/features/account/wallet/**`
- `apps/frontend/features/account/account/components/account-overview.tsx`
- `apps/frontend/features/catalog/products/components/alert-button.tsx`
- `apps/frontend/lib/api/hooks.ts` (removed)
- `apps/frontend/lib/api/account-hooks.ts` (removed)
- `apps/frontend/lib/api/query-keys.ts`
- `apps/frontend/lib/api/endpoints.ts`
- `refactor-workstreams/gpt56-domain-refactor-20260713/TASKS.md`
- `refactor-workstreams/gpt56-domain-refactor-20260713/IN_PROGRESS.md`
- `refactor-workstreams/gpt56-domain-refactor-20260713/FINISHED.md`
- `refactor-logs/035-wallet-small-account-apis-gpt56-20260713.md`

## Verification

- Frontend lint: zero errors, 14 existing warnings.
- TypeScript: passed.
- Backend tests: passed.
- No stale central imports/definitions.
- Independent review: no findings.
- `git diff --check`: passed.
