# Task 046d: Thin Category-Edit Route

**Status:** Complete
**Date:** 2026-07-14

- Added server-only `CategoryEditView` beside `CategoryCreateView` and reused the
  shared category-tree loader.
- Reduced the route to `PRODUCTS_READ`, async parameter resolution, and the view.
- Preserved the raw string ID request, `ApiError` 404-to-`notFound`, other error
  propagation, tree fallback, header copy, back link, and `CategoryForm` props.
- Scoped ESLint, full typecheck, ownership/stale-import searches, and diff check
  passed.
