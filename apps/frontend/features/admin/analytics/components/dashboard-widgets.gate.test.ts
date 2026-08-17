import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchRevenueToday: vi.fn(),
  fetchRevenueTimeSeries: vi.fn(),
  listAdminOrders: vi.fn(),
  fetchLowStockInventory: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/features/analytics/api", () => ({
  fetchRevenueToday: mocks.fetchRevenueToday,
  fetchRevenueTimeSeries: mocks.fetchRevenueTimeSeries,
}));
vi.mock("@/features/orders/api/admin", () => ({
  listAdminOrders: mocks.listAdminOrders,
}));
vi.mock("@/features/inventory/api", () => ({
  fetchLowStockInventory: mocks.fetchLowStockInventory,
}));

import { PERMISSIONS } from "@/lib/rbac/permissions";

import { LowStockList } from "./LowStockList";
import { OrderStatusSection } from "./OrderStatusSection";
import { RecentOrdersTable } from "./RecentOrdersTable";
import { RevenueCards } from "./RevenueCards";
import { RevenueChartSection } from "./RevenueChartSection";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("dashboard analytics widget permission gates", () => {
  it("skips revenue and order-status fetches without analytics:read", async () => {
    await expect(RevenueCards({ permissions: [] })).resolves.toBeNull();
    await expect(RevenueChartSection({ permissions: [] })).resolves.toBeNull();
    await expect(OrderStatusSection({ permissions: [] })).resolves.toBeNull();

    expect(mocks.fetchRevenueToday).not.toHaveBeenCalled();
    expect(mocks.fetchRevenueTimeSeries).not.toHaveBeenCalled();
  });

  it("skips recent-orders fetch without orders:read", async () => {
    await expect(
      RecentOrdersTable({ permissions: [PERMISSIONS.ANALYTICS_READ] }),
    ).resolves.toBeNull();
    expect(mocks.listAdminOrders).not.toHaveBeenCalled();
  });

  it("skips low-stock fetch without inventory:read", async () => {
    await expect(
      LowStockList({ permissions: [PERMISSIONS.ANALYTICS_READ] }),
    ).resolves.toBeNull();
    expect(mocks.fetchLowStockInventory).not.toHaveBeenCalled();
  });

  it("fetches when the matching read permission is present", async () => {
    mocks.fetchRevenueToday.mockResolvedValue(null);
    mocks.fetchRevenueTimeSeries.mockResolvedValue([]);
    mocks.listAdminOrders.mockResolvedValue({ results: [] });
    mocks.fetchLowStockInventory.mockResolvedValue([]);

    await RevenueCards({ permissions: [PERMISSIONS.ANALYTICS_READ] });
    await RevenueChartSection({ permissions: [PERMISSIONS.ANALYTICS_READ] });
    await OrderStatusSection({ permissions: [PERMISSIONS.ANALYTICS_READ] });
    await RecentOrdersTable({ permissions: [PERMISSIONS.ORDERS_READ] });
    await LowStockList({ permissions: [PERMISSIONS.INVENTORY_READ] });

    expect(mocks.fetchRevenueToday).toHaveBeenCalledTimes(2);
    expect(mocks.fetchRevenueTimeSeries).toHaveBeenCalledOnce();
    expect(mocks.listAdminOrders).toHaveBeenCalledOnce();
    expect(mocks.fetchLowStockInventory).toHaveBeenCalledOnce();
  });
});
