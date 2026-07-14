# Task 045i: Thin Journal-List Route

**Status:** Complete
**Date:** 2026-07-14

- Moved the current journal-list composition to
  `features/journal/components/journal-list-view.tsx`.
- Left metadata/revalidation in the route and preserved promised page params,
  JSON-LD, featured logic, explorer behavior, and pagination.
- Scoped ESLint, full typecheck, ownership search, and diff check passed.
