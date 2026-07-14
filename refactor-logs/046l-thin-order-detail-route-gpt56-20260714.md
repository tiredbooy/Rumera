# Task 046l: Thin Order-Detail Route

**Status:** Complete
**Date:** 2026-07-14

- Added server-only `OrderDetailView` under the admin orders feature.
- Reduced the route to `ORDERS_READ`, async params, positive integer validation,
  route-computed `ORDERS_WRITE`, and view composition.
- Preserved the canonical admin API and 404 behavior, header/breadcrumb, payment
  and status output, invoice rows/totals, summary, and `OrderActions` client island.
- Scoped ESLint, full typecheck, ownership/stale-import searches, and diff check
  passed.
