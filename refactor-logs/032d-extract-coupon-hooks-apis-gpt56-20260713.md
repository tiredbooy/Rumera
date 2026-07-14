# Task 032d: Extract Coupon Hooks And APIs

**Status:** Complete
**Date:** 2026-07-13

- Added coupon-domain validation request and hook.
- Migrated checkout and removed the central definition.
- Preserved payloads, response unwrapping, errors, and no-cache behavior.
- Parallel behavioral and migration reviewers found no defects.

## Files touched

- `apps/frontend/features/coupons/api.ts`
- `apps/frontend/features/checkout/components/checkout-flow.tsx`
- `apps/frontend/lib/api/hooks.ts`
- `apps/frontend/lib/api/account-hooks.ts`
- `apps/frontend/lib/api/endpoints.ts`
- `refactor-workstreams/gpt56-domain-refactor-20260713/TASKS.md`
- `refactor-workstreams/gpt56-domain-refactor-20260713/IN_PROGRESS.md`
- `refactor-workstreams/gpt56-domain-refactor-20260713/IN_PROGRESS_TASK_032D_GPT56.md` (removed)
- `refactor-workstreams/gpt56-domain-refactor-20260713/FINISHED.md`
- `refactor-logs/032d-extract-coupon-hooks-apis-gpt56-20260713.md`

## Verification

- Combined scoped ESLint: zero warnings or errors.
- No central Task Group 032 definitions/imports remain.
- Full TypeScript reports no Task Group 032 errors.
- `git diff --check` passed.
