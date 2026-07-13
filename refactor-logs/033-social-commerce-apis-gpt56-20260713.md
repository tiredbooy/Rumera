# Task Group 033: Social-Commerce Domain APIs

**Status:** Complete
**Date:** 2026-07-13
**Workstream:** `gpt56-domain-refactor-20260713`

## What Changed

- Extracted review, wishlist, and recommendation APIs, hooks, actions, and keys to
  their owning domains.
- Migrated all account, product, home, and admin consumers and removed stale
  central/mock/app-route dependencies.
- Added real account review routes, live paginated moderation, direct wishlist
  product links, and authenticated recommendation profile operations.
- Fixed review scan/uniqueness/voting/authorization defects, wishlist null-stock
  and empty-array behavior, public anonymous caching, and recommendation signal
  trust/order-status correctness.

## Verification

- `go test ./...` and `go vet ./...` passed.
- Full frontend lint passed with zero errors.
- No Task Group 033 TypeScript errors remain.
- Independent backend and frontend reviews were resolved.
- Stale dependency searches and `git diff --check` passed.

## Follow-Up

- Align backend admin authorization with frontend support/manager permissions in a
  dedicated cross-domain RBAC task.
