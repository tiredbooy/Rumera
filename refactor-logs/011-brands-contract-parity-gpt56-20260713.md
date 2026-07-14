# Task 011: Brands Contract Parity

**Status:** Complete
**Date:** 2026-07-13
**Workstream:** `gpt56-domain-refactor-20260713`

## What Changed

- Established one backend-derived `Brand` entity and named create/update/query
  contracts.
- Corrected optional/null semantics and paginated list responses.
- Removed duplicate admin Brand response/request/filter declarations.
- Added an executable Brand-scoped browser BFF client preserving validation
  fields, then migrated the Brand form/table away from missing global modules.
- Migrated Brand-only routes and product lookup consumers to the canonical owner.

## Verification

- Scoped ESLint: zero errors, one existing React Hook Form compiler warning.
- Old Brand response/request/filter names have zero active references.
- Brand-owned files no longer import deleted catalog/admin-client modules.
- Full TypeScript validation reports no Brand-specific failures.

## Notes / Follow-Ups

- Backend PATCH cannot currently clear nullable Brand values because null and
  omission both decode to nil pointers.
- Task 030a owns final public/admin Brand API organization.
