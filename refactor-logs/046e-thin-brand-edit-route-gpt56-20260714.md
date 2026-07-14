# Task 046e: Thin Brand-Edit Route

**Status:** Complete
**Date:** 2026-07-14

- Added server-only `BrandEditView` under the admin brands feature.
- Reduced the route to `PRODUCTS_WRITE`, async parameter resolution, and the view.
- Preserved the raw string ID request, `ApiError` 404-to-`notFound`, other error
  propagation, header copy, back link, and exact `BrandForm` props.
- Scoped ESLint, full typecheck, ownership/stale-import searches, and diff check
  passed.
