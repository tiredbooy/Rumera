# Task 009: Product Request And Filter Parity

**Status:** Complete
**Date:** 2026-07-13
**Workstream:** `gpt56-domain-refactor-20260713`

## What Changed

- Added backend-derived product create/update, variant create/update, tag IDs,
  option IDs, image mutation, and listing query contracts with clear `Input` and
  `Query` names.
- Corrected option association to `option_value_ids` and separated variant update
  fields from create fields.
- Corrected product tag and image mutation paths/bodies/`204` return types.
- Fixed multipart field/header handling and switched the mounted image uploader
  to the browser client with the correct BFF path.
- Preserved current form layout and interactions while carrying option IDs
  through defaults and create payloads.

## Verification

- Scoped ESLint: zero errors, one known React Hook Form compiler warning.
- Obsolete request/filter names and request body patterns have zero active
  references.
- Full TypeScript validation removed the uploader signature errors and introduced
  no new task-related failures.

## Notes / Follow-Ups

- No option CRUD or selector was invented.
- Multi-step product submission and uploader consolidation remain separate tasks.
