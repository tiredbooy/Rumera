import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PERMISSIONS, type Permission } from "@/lib/rbac/permissions";

const mocks = vi.hoisted(() => ({
  requireStaff: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  requireStaff: mocks.requireStaff,
}));
vi.mock("@/features/admin/analytics/components/RecentOrdersTable", () => ({
  RecentOrdersTable: () => <div data-widget="recent-orders" />,
}));
vi.mock("@/features/admin/analytics/components/LowStockList", () => ({
  LowStockList: () => <div data-widget="low-stock" />,
}));
vi.mock("@/features/dashboard/components/admin-work-queue", () => ({
  AdminWorkQueue: ({ permissions }: { permissions: Permission[] }) => (
    <div data-widget="work-queue">{permissions.join(",")}</div>
  ),
  AdminWorkQueueSkeleton: () => null,
}));

import AdminDashboard from "./page";

beforeEach(() => {
  vi.clearAllMocks();
});

function sessionWith(permissions: Permission[]) {
  mocks.requireStaff.mockResolvedValue({ permissions });
}

describe("admin dashboard widget gates", () => {
  // S-1. The landing page is a work queue now, not a second analytics page.
  it("leads with the work queue and no longer duplicates the analytics page", async () => {
    sessionWith([PERMISSIONS.ORDERS_READ, PERMISSIONS.ANALYTICS_READ]);

    const html = renderToStaticMarkup(await AdminDashboard());

    expect(html).toContain('data-widget="work-queue"');
    // These three lived here and on /admin/analytics; only the latter now.
    expect(html).not.toContain('data-widget="revenue-cards"');
    expect(html).not.toContain('data-widget="revenue-chart"');
    expect(html).not.toContain('data-widget="order-status"');
    // The revenue reporting is still reachable, just not the first thing seen.
    expect(html).toContain("/admin/analytics");
  });

  it("offers no analytics link without analytics:read", async () => {
    sessionWith([PERMISSIONS.ORDERS_READ]);

    const html = renderToStaticMarkup(await AdminDashboard());

    expect(html).not.toContain("/admin/analytics");
  });

  it("renders the work queue for any staff session; it gates its own tiles", async () => {
    sessionWith([PERMISSIONS.CUSTOMERS_READ]);

    const html = renderToStaticMarkup(await AdminDashboard());

    expect(html).toContain("داشبورد");
    expect(html).toContain('data-widget="work-queue"');
    expect(html).not.toContain("دسترسی سریع عملیاتی");
    expect(html).not.toContain('data-widget="module-overview"');
    expect(html).not.toContain('data-widget="recent-orders"');
    expect(html).not.toContain('data-widget="low-stock"');
  });

  it("renders only the detail widgets the live session may read", async () => {
    sessionWith([PERMISSIONS.ORDERS_READ, PERMISSIONS.INVENTORY_READ]);

    const html = renderToStaticMarkup(await AdminDashboard());

    expect(html).toContain('data-widget="recent-orders"');
    expect(html).toContain('data-widget="low-stock"');
  });

  it("passes the live permission set to the work queue", async () => {
    sessionWith([PERMISSIONS.ORDERS_READ]);

    const html = renderToStaticMarkup(await AdminDashboard());

    expect(html).toContain(PERMISSIONS.ORDERS_READ);
  });
});
