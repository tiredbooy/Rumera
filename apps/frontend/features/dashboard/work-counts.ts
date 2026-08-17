import "server-only";

import { cache } from "react";

import { listInventory } from "@/features/inventory/api";
import { listAdminOrders } from "@/features/orders/api/admin";
import { listAdminPayments } from "@/features/payments/api/admin";
import { listAdminReviews } from "@/features/reviews/api";
import { can } from "@/lib/rbac/can";
import { PERMISSIONS, type Permission } from "@/lib/rbac/permissions";

import { loadCount, type CountState } from "./components/module-card";

/** Paid but not yet handed to a carrier. Mutually exclusive, so the sum is exact. */
export const UNFULFILLED_STATUSES = "paid,processing,ready_to_ship";

export type AdminWorkCounts = {
  pendingOrders: CountState;
  unfulfilled: CountState;
  failedPayments: CountState;
  pendingPayments: CountState;
  pendingReviews: CountState;
  lowStock: CountState;
};

/**
 * S-1 / S-4. One request-scoped load of the work-queue totals. The dashboard
 * tiles and the sidebar badges share this so a failed fetch cannot read as
 * "nothing waiting" in one place and a number in the other.
 */
function permissionKey(permissions: readonly Permission[]): string {
  return [...permissions].sort().join(",");
}

const loadCached = cache(async (key: string): Promise<AdminWorkCounts> => {
  const permissions = (key ? key.split(",") : []) as Permission[];
  const session = { permissions };
  const canOrders = can(session, PERMISSIONS.ORDERS_READ);

  const [
    pendingOrders,
    unfulfilled,
    failedPayments,
    pendingPayments,
    pendingReviews,
    lowStock,
  ] = await Promise.all([
      loadCount(canOrders, async () => {
        const r = await listAdminOrders({
          page: 1,
          limit: 1,
          status: "pending",
        });
        return r.pagination.total_items;
      }),
      loadCount(canOrders, async () => {
        const r = await listAdminOrders({
          page: 1,
          limit: 1,
          statuses: UNFULFILLED_STATUSES,
        });
        return r.pagination.total_items;
      }),
      loadCount(canOrders, async () => {
        const r = await listAdminOrders({
          page: 1,
          limit: 1,
          status: "payment_failed",
        });
        return r.pagination.total_items;
      }),
      loadCount(can(session, PERMISSIONS.PAYMENTS_READ), async () => {
        const r = await listAdminPayments({
          page: 1,
          limit: 1,
          status: "pending",
        });
        return r.pagination.total_items;
      }),
      loadCount(can(session, PERMISSIONS.REVIEWS_READ), async () => {
        const r = await listAdminReviews({
          page: 1,
          limit: 1,
          status: "pending",
        });
        return r.pagination.total_items;
      }),
      loadCount(can(session, PERMISSIONS.INVENTORY_READ), async () => {
        const r = await listInventory({
          page: 1,
          limit: 1,
          low_stock: true,
        });
        return r.pagination.total_items;
      }),
    ]);

  return {
    pendingOrders,
    unfulfilled,
    failedPayments,
    pendingPayments,
    pendingReviews,
    lowStock,
  };
});

export function loadAdminWorkCounts(
  permissions: readonly Permission[],
): Promise<AdminWorkCounts> {
  return loadCached(permissionKey(permissions));
}

function sumKnown(parts: CountState[]): number | undefined {
  const known = parts.filter((n): n is number => typeof n === "number");
  if (known.length === 0) return undefined;
  return known.reduce((a, b) => a + b, 0);
}

/** Sidebar badges keyed by nav href. Omits zero / unknown so a miss is not "0". */
export function navBadgesFromWorkCounts(
  counts: AdminWorkCounts,
): Record<string, number> {
  const badges: Record<string, number> = {};
  const orders = sumKnown([
    counts.pendingOrders,
    counts.unfulfilled,
    counts.failedPayments,
  ]);
  if (orders) badges["/admin/orders"] = orders;
  if (typeof counts.pendingPayments === "number" && counts.pendingPayments > 0) {
    badges["/admin/payments"] = counts.pendingPayments;
  }
  if (typeof counts.pendingReviews === "number" && counts.pendingReviews > 0) {
    badges["/admin/reviews"] = counts.pendingReviews;
  }
  if (typeof counts.lowStock === "number" && counts.lowStock > 0) {
    badges["/admin/inventory"] = counts.lowStock;
  }
  return badges;
}
