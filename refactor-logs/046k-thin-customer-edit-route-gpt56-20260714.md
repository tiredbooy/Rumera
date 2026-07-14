# Task 046k: Thin Customer-Edit Route

**Status:** Complete
**Date:** 2026-07-14

- Added server-only `CustomerEditView` under the admin customers feature.
- Reduced the route to `CUSTOMERS_WRITE`, async params, target/current IDs, and
  view composition.
- Preserved the admin user API, custom unavailable state for active-user 404s,
  self detection, breadcrumb/header, and exact `UserEditForm` props.
- Scoped ESLint, full typecheck, ownership/stale-import searches, and diff check
  passed.
