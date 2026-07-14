# Task 013: Orders Contract Parity

**Status:** Complete
**Date:** 2026-07-13

## What changed

- Rebuilt canonical order detail, list, item, status, payment, mutation-input, and
  list-query contracts from the active Go HTTP surface.
- Preserved the full 13-status enum and exact snake_case response/request fields.
- Removed duplicate legacy/admin order type modules and their invented user,
  address, request-item, and timestamp fields.
- Corrected account/admin list API types to `Paginated<OrderListItem>`.
- Replaced the admin API's local order subset and corrected its sort query keys.

## Files touched

- `apps/frontend/features/orders/types.ts`
- `apps/frontend/features/orders/api.ts`
- `apps/frontend/features/admin/orders/api.ts`
- `apps/frontend/features/admin/orders/types.ts` (removed)
- `apps/frontend/lib/types/orders/types.ts` (removed)
- `apps/frontend/features/admin/analytics/components/RecentOrdersTable.tsx`
- `refactor-workstreams/gpt56-domain-refactor-20260713/TASKS.md`
- `refactor-workstreams/gpt56-domain-refactor-20260713/FINISHED.md`
- `refactor-logs/013-orders-contract-parity-gpt56-20260713.md`

## Verification

- Scoped ESLint passed with zero errors and zero warnings.
- Searches confirmed one active order contract owner and no stale duplicate type
  names, camelCase wire fields, or incorrect sort query keys.
- `git diff --check` passed.
- Full TypeScript validation remains blocked by the documented deleted catalog
  modules and disabled admin client. No new order-contract failures appeared.

## Notes / follow-ups

- Task 027c owns remaining deleted order catalog/label imports; Task 031 owns the
  account/admin API split.
- Backend order lists and status-update responses currently map required
  `item_count` as zero. The frontend type reflects the wire contract rather than
  hiding that backend defect.
- Task 011 continues independently under its dedicated claim file.
