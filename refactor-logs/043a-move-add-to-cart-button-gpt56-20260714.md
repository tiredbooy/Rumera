# Task 043a: Move Add-To-Cart Button

**Status:** Complete
**Date:** 2026-07-14

## What changed

- Moved the real variant-aware mutation to `features/cart/components`.
- Updated all three active consumers directly.
- Removed the unused fake button and old product-domain location.
- Added a unique cart-line migration and atomic cumulative stock enforcement for
  add, bulk-add, and quantity updates.

## Verification

- Full backend tests, scoped ESLint, and full typecheck passed.
- Ownership search and `git diff --check` passed.
