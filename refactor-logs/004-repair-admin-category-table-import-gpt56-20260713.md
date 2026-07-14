# Task 004: Repair Admin Category-Table Import

**Status:** Complete
**Date:** 2026-07-13
**Workstream:** `gpt56-domain-refactor-20260713`

## What Changed

- Updated `app/admin/categories/page.tsx` to import `CategoriesTable` from the
  existing `features/admin/categories/components/CategoryTable.tsx` module.
- Made no export, prop, permission, rendering, style, state, or behavior changes.

## Files Touched

- `apps/frontend/app/admin/categories/page.tsx`

## Verification

- Scoped ESLint passed.
- The stale lowercase/hyphenated path has zero remaining references.
- Full TypeScript validation was rerun; the targeted module error was removed and
  no new task-related errors appeared.

## Notes / Follow-Ups

- The full frontend typecheck remains blocked by the pre-existing incomplete
  domain migration documented in the workstream audit.
