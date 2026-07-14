# Task 027c: Migrate Order Catalog Imports And Labels

**Status:** Complete
**Date:** 2026-07-13

## What changed

- Added order-owned status/payment labels and cancellation logic.
- Moved generic Persian date formatting into `lib/utils/date.ts`.
- Migrated all order type and label consumers from deleted catalog modules.
- Replaced `PlaceOrderInput` with canonical `CreateOrderInput`.
- Removed the confirmation page's incomplete local status map.
- Added no compatibility shim.

## Files touched

- `apps/frontend/features/orders/labels.ts`
- `apps/frontend/lib/utils/date.ts`
- `apps/frontend/lib/api/hooks.ts`
- `apps/frontend/features/checkout/components/checkout-flow.tsx`
- `apps/frontend/app/(storefront)/checkout/confirmation/[id]/page.tsx`
- `apps/frontend/components/admin/status-badge.tsx`
- `apps/frontend/features/account/account/components/account-overview.tsx`
- `apps/frontend/features/account/orders/components/OrdersList.tsx`
- `apps/frontend/features/account/orders/components/OrderStatusStepper.tsx`
- `apps/frontend/features/account/orders/components/OrderCard.tsx`
- `apps/frontend/features/account/orders/components/OrderDetail.tsx`
- `apps/frontend/features/admin/orders/components/OrdersTable.tsx`
- `apps/frontend/features/admin/orders/components/OrderActions.tsx`
- `apps/frontend/app/admin/orders/[id]/page.tsx`
- `apps/frontend/features/admin/analytics/components/RecentOrdersTable.tsx`
- `apps/frontend/features/account/reviews/components/reviews-view.tsx`
- `apps/frontend/app/admin/customers/page.tsx`
- `apps/frontend/app/admin/customers/[id]/page.tsx`
- `refactor-workstreams/gpt56-domain-refactor-20260713/TASKS.md`
- `refactor-workstreams/gpt56-domain-refactor-20260713/IN_PROGRESS.md`
- `refactor-workstreams/gpt56-domain-refactor-20260713/FINISHED.md`
- `refactor-logs/027c-migrate-order-imports-labels-gpt56-20260713.md`

## Verification

- Scoped ESLint passed with zero errors and zero warnings.
- Searches confirmed zero imports from deleted catalog type/label modules.
- `git diff --check` passed.
- Full TypeScript no longer reports order/catalog-label migration failures.

## Notes / follow-ups

- Task 027d owns remaining checkout migration inventory.
- Missing global admin-client/data dependencies remain separate later tasks.
