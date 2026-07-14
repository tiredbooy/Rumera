# Task 046j: Thin Customer-Detail Route

**Status:** Complete
**Date:** 2026-07-14

- Added server-only `CustomerDetailView` under the admin customers feature.
- Reduced the route to `CUSTOMERS_READ`, async params, route-computed
  `CUSTOMERS_WRITE`, and view composition.
- Preserved the admin user API, custom unavailable state for active-user 404s,
  other error propagation, header/breadcrumb/actions, badges, and identity fields.
- Scoped ESLint, full typecheck, ownership/stale-import searches, and diff check
  passed.
