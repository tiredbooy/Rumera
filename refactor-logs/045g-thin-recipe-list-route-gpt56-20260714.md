# Task 045g: Thin Recipe-List Route

**Status:** Complete
**Date:** 2026-07-14

- Moved the current recipe-list server composition to
  `features/recipes/components/recipe-list-view.tsx`.
- Left metadata/revalidation in the route and preserved promised search params,
  JSON-LD, spotlight logic, filters, and pagination.
- Scoped ESLint, full typecheck, ownership search, and diff check passed.
