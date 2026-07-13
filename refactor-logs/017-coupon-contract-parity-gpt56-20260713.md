# Task 017: Coupon Contract Parity

**Status:** Complete
**Date:** 2026-07-13
**Workstream:** `gpt56-domain-refactor-20260713`

## What Changed

- Added canonical backend-derived coupon entity, write inputs, validation input,
  and list query contracts.
- Modeled validation nullability as a discriminated union.
- Explicitly modeled the backend's PascalCase embedded persistence object as
  `LegacyCouponValidationCoupon`.
- Migrated the checkout hook and flow to the actual validation wire contract.
- Removed duplicate orphan admin coupon types.

## Verification

- Scoped ESLint passed with zero errors and warnings.
- Old coupon response/request/filter names have zero active references.
- Checkout no longer imports coupon types from the deleted catalog module.
- Full TypeScript validation reports no Coupon-specific failures.
- `git diff --check` passed.

## Notes / Follow-Ups

- Backend validation serialization and PATCH clear semantics remain documented
  blockers.
- Checkout stale coupon state and free-shipping gating remain Task 050.
