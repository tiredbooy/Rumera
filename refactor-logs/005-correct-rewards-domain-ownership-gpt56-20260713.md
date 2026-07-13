# Task 005: Correct Rewards Domain Ownership

**Status:** Complete
**Date:** 2026-07-13
**Workstream:** `gpt56-domain-refactor-20260713`

## What Changed

- Confirmed `RewardsView` belongs to loyalty through its account, transaction,
  and redemption hooks backed by the loyalty API/service.
- Moved it from `features/journal/components/rewards-view.tsx` to
  `features/loyalty/components/rewards-view.tsx`.
- Updated the account rewards route directly without a re-export shim.

## Files Touched

- `apps/frontend/app/(account)/account/rewards/page.tsx`
- `apps/frontend/features/loyalty/components/rewards-view.tsx`
- `apps/frontend/features/journal/components/rewards-view.tsx` (moved)

## Verification

- Scoped ESLint passed.
- Old ownership paths have zero remaining references.
- The targeted TypeScript module error was removed without new task-related
  errors.

## Notes / Follow-Ups

- Loyalty hooks/types remain centralized until their dedicated contract and API
  extraction tasks.
