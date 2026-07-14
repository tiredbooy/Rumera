# Task 046b: Thin Product-Edit Route

**Status:** Complete
**Date:** 2026-07-14

- Added server-only `ProductEditView` beside `ProductCreateView` and reused the
  shared product option loader.
- Reduced the route to `PRODUCTS_READ`, async parameter resolution, and the view.
- Preserved `Number(id)`, `ApiError` 404-to-`notFound`, other error propagation,
  option fallbacks, header copy, back link, and `ProductForm` props.
- Scoped ESLint, full typecheck, ownership/stale-import searches, and diff check
  passed.
