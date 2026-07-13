# Task 028: Split Product APIs By Public/Admin Caller

**Status:** Complete
**Date:** 2026-07-13
**Workstream:** `gpt56-domain-refactor-20260713`

## What Changed

- Added explicit `api/public.ts`, `api/server.ts`, and retained browser-only
  `api/client.ts` boundaries with no re-export shim.
- Removed duplicate/dead product API wrappers and the dead upload route.
- Made actions thin, migrated product-specific global-client consumers, restored
  the admin product list route, and removed stale product form props.

## Verification

- Scoped ESLint passed with zero errors and one existing form warning.
- No stale product API/global-client imports remain.
- No product-specific TypeScript failures remain.
- `git diff --check` passed.

## Follow-Ups

- Uploader consolidation remains Task 040.
- Sample product deletion/duplication behavior remains an explicit later task.
