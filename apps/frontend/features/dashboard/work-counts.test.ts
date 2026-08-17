import { beforeEach, describe, expect, it, vi } from "vitest";

import { PERMISSIONS } from "@/lib/rbac/permissions";

const mocks = vi.hoisted(() => ({
  listAdminOrders: vi.fn(),
  listAdminReviews: vi.fn(),
  listAdminPayments: vi.fn(),
  listInventory: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/features/orders/api/admin", () => ({
  listAdminOrders: mocks.listAdminOrders,
}));
vi.mock("@/features/reviews/api", () => ({
  listAdminReviews: mocks.listAdminReviews,
}));
vi.mock("@/features/inventory/api", () => ({
  listInventory: mocks.listInventory,
}));
vi.mock("@/features/payments/api/admin", () => ({
  listAdminPayments: mocks.listAdminPayments,
}));

import {
  loadAdminWorkCounts,
  navBadgesFromWorkCounts,
} from "./work-counts";

function paginated(total: number) {
  return { results: [], pagination: { total_items: total } };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listAdminOrders.mockResolvedValue(paginated(3));
  mocks.listAdminReviews.mockResolvedValue(paginated(7));
  mocks.listAdminPayments.mockResolvedValue(paginated(2));
  mocks.listInventory.mockResolvedValue(paginated(5));
});

describe("navBadgesFromWorkCounts", () => {
  it("sums the three order queues onto /admin/orders", () => {
    expect(
      navBadgesFromWorkCounts({
        pendingOrders: 2,
        unfulfilled: 3,
        failedPayments: 1,
        pendingPayments: 8,
        pendingReviews: 4,
        lowStock: 5,
      }),
    ).toEqual({
      "/admin/orders": 6,
      "/admin/payments": 8,
      "/admin/reviews": 4,
      "/admin/inventory": 5,
    });
  });

  it("omits a queue that failed or is not permitted", () => {
    expect(
      navBadgesFromWorkCounts({
        pendingOrders: 2,
        unfulfilled: null,
        failedPayments: undefined,
        pendingPayments: 0,
        pendingReviews: 0,
        lowStock: null,
      }),
    ).toEqual({
      "/admin/orders": 2,
    });
  });
});

describe("loadAdminWorkCounts", () => {
  it("skips fetchers the session cannot read", async () => {
    const counts = await loadAdminWorkCounts([PERMISSIONS.ORDERS_READ]);
    expect(counts.pendingOrders).toBe(3);
    expect(counts.pendingPayments).toBeUndefined();
    expect(counts.pendingReviews).toBeUndefined();
    expect(counts.lowStock).toBeUndefined();
    expect(mocks.listAdminPayments).not.toHaveBeenCalled();
    expect(mocks.listAdminReviews).not.toHaveBeenCalled();
    expect(mocks.listInventory).not.toHaveBeenCalled();
  });
});
