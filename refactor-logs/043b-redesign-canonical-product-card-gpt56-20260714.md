# Task 043b: Consolidate And Redesign The Canonical Product Card

**Status:** Complete
**Date:** 2026-07-14

## What changed

- Removed the unused synthetic card and generated bottle visual from live cards.
- Added real responsive media, valid links, truthful price/availability, and a
  larger luxe-minimal card layout.
- Added inventory-aware active/available counts and an optional deterministic
  single-variant list projection.
- Added real quick-add and wishlist client actions without guessing variants.
- Moved the reusable optimized image out of admin ownership.
- Made product listings uncached because their action capability reflects live
  stock.

## Verification

- Backend contract and scoped repository tests passed.
- Scoped ESLint and full frontend typecheck passed.
- Ownership searches and `git diff --check` passed.
- Responsive Playwright checks and independent acceptance review passed.
