# Task 043g: Move Category Image Input

**Status:** Complete
**Date:** 2026-07-14

- Replaced the fake CDN uploader with a category-owned real uploader wrapper.
- Moved the generic field to `features/admin/uploads/components`.
- Fixed default MIME validation and added the backend `categories` folder.
- Updated category, hero, and recipe consumers directly.
- Prevented parent-form submission while an image upload is still in flight.
- Scoped backend tests, ESLint, full typecheck, ownership search, and diff check
  passed.
