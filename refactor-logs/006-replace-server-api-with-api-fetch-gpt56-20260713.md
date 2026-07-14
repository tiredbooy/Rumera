# Task 006: Replace `serverApi` With `apiFetch`

**Status:** Complete
**Date:** 2026-07-13
**Workstream:** `gpt56-domain-refactor-20260713`

## What Changed

- Verified historical `serverApi` behavior against the current canonical
  `apiFetch` implementation.
- Replaced every `serverApi` import and call in the 13 current route callers.
- Preserved generic types, endpoints, authentication, response unwrapping,
  caching, `ApiError` handling, permissions, and route behavior.
- Added no alias or compatibility shim.

## Files Touched

- Admin category create/edit routes.
- Admin brand edit and settings routes.
- Admin recipe and product create/edit routes.
- Admin order detail route.
- Admin customer list/detail/edit routes.
- Storefront checkout confirmation route.

## Verification

- Scoped ESLint passed for all touched routes and `lib/api/client.ts`.
- `serverApi` has zero remaining TypeScript references.
- Full TypeScript validation was rerun; every targeted missing-export error was
  removed without new task-related errors.

## Notes / Follow-Ups

- Remaining compile failures belong to the previously documented incomplete
  domain type and API migrations.
