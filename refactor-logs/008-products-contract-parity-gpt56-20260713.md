# Task 008: Products Contract Parity

**Status:** Complete
**Date:** 2026-07-13
**Workstream:** `gpt56-domain-refactor-20260713`

## What Changed

- Rebuilt frontend product response types from Go JSON tags, mappers, list-query
  projections, and handlers.
- Introduced business names `ProductImage`, `ProductVariant`,
  `ProductOptionValue`, and `ProductTag`.
- Corrected optional-vs-null semantics and preserved the nullable list image.
- Corrected product list APIs to the shared paginated envelope.
- Removed admin response re-exports and migrated direct product consumers to the
  catalog product domain.

## Verification

- Scoped ESLint passed.
- Canonical product response declarations exist in one file only.
- Old product `*Response` names have no active references.
- Full TypeScript validation found no new task-related failures and removed the
  previous undefined `ProductImage` error.

## Notes / Follow-Ups

- Requests and filters move next in Task 009.
- Deleted product helper replacement and uploader behavior are deliberately
  deferred to their planned tasks.
