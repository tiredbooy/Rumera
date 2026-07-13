# Task 031: Split Order APIs By Account/Admin Caller

**Status:** Complete
**Date:** 2026-07-13
**Workstream:** `gpt56-domain-refactor-20260713`

## What Changed

- Added explicit server and browser account/admin order transports.
- Moved order hooks and cache keys into the order domain.
- Migrated account, checkout, admin, and analytics consumers.
- Removed fake admin orders, dead placeholders, duplicate APIs, and unsupported
  order controls.
- Fixed backend order-list scanning after gift-mode schema changes and now returns
  real item quantity totals.

## Verification

- `go test ./...` and `go vet ./...` passed.
- Scoped ESLint passed cleanly; full lint has zero errors.
- No order-specific TypeScript errors remain.
- Stale order dependency searches and `git diff --check` passed.

## Follow-Up

- Align backend admin authorization with frontend support/manager permissions in a
  dedicated cross-domain RBAC task.
