# Task 014: Addresses Contract Parity

**Status:** Complete
**Date:** 2026-07-13
**Workstream:** `gpt56-domain-refactor-20260713`

## What Changed

- Added canonical backend-derived live Address, create input, and partial update
  input contracts in `features/addresses/types.ts`.
- Migrated address hooks, account forms/views, checkout, and subscriptions to the
  domain owner.
- Corrected success envelopes and the set-default `204` return type.
- Removed an unsupported order `shipping_address` assertion rather than inventing
  a backend field.

## Verification

- Scoped ESLint: zero errors, one unrelated existing subscription warning.
- No stale Address imports or `AddressInput` declarations remain.
- Full TypeScript validation reports no Address-specific failures.
- `git diff --check` passed.

## Notes / Follow-Ups

- PATCH cannot currently clear nullable address fields because null and omission
  both decode to nil pointers.
- Country encoding and checkout default-address behavior remain explicit UX
  follow-ups.
