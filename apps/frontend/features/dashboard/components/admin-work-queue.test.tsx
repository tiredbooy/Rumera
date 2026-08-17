import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PERMISSIONS, type Permission } from "@/lib/rbac/permissions";

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

import { AdminWorkQueue } from "./admin-work-queue";

function paginated(total: number) {
  return { results: [], pagination: { total_items: total } };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listAdminOrders.mockResolvedValue(paginated(3));
  mocks.listAdminReviews.mockResolvedValue(paginated(7));
  mocks.listAdminPayments.mockResolvedValue(paginated(4));
  mocks.listInventory.mockResolvedValue(paginated(5));
});

async function render(permissions: Permission[]) {
  return renderToStaticMarkup(await AdminWorkQueue({ permissions }));
}

describe("AdminWorkQueue", () => {
  // S-1: every tile must open the list already filtered to the things it counted,
  // otherwise the operator lands on an unfiltered screen and has to filter again.
  it("links each tile to the list filtered to exactly what it counted", async () => {
    const html = await render([
      PERMISSIONS.ORDERS_READ,
      PERMISSIONS.PAYMENTS_READ,
      PERMISSIONS.REVIEWS_READ,
      PERMISSIONS.INVENTORY_READ,
    ]);

    expect(html).toContain("/admin/orders?status=pending");
    expect(html).toContain("/admin/orders?status=payment_failed");
    expect(html).toContain("/admin/payments?status=pending");
    expect(html).toContain("/admin/reviews?status=pending");
    expect(html).toContain("/admin/inventory?low_stock=true");
    // Paid-but-unfulfilled spans three statuses; the multi-status filter is what
    // makes one URL for it possible at all.
    expect(html).toContain("statuses=paid%2Cprocessing%2Cready_to_ship");
  });

  it("counts unfulfilled orders with the multi-status filter, not a single status", async () => {
    await render([PERMISSIONS.ORDERS_READ]);

    const calls = mocks.listAdminOrders.mock.calls.map(([q]) => q);
    expect(calls).toContainEqual({
      page: 1,
      limit: 1,
      statuses: "paid,processing,ready_to_ship",
    });
  });

  it("omits tiles the session cannot read", async () => {
    const html = await render([PERMISSIONS.ORDERS_READ]);

    expect(html).toContain("/admin/orders?status=pending");
    expect(html).not.toContain("/admin/reviews");
    expect(html).not.toContain("/admin/inventory");
    expect(html).not.toContain("/admin/payments");
    expect(mocks.listAdminReviews).not.toHaveBeenCalled();
    expect(mocks.listInventory).not.toHaveBeenCalled();
    expect(mocks.listAdminPayments).not.toHaveBeenCalled();
  });

  // S-8: the old "quick operational access" grid is gone; its one real
  // task — pending payment transactions — now lives on the work queue.
  it("carries pending payments onto the work queue with the filtered payments list", async () => {
    const html = await render([PERMISSIONS.PAYMENTS_READ]);

    expect(html).toContain("پرداخت‌های در انتظار");
    expect(html).toContain("/admin/payments?status=pending");
    expect(mocks.listAdminPayments).toHaveBeenCalledWith({
      page: 1,
      limit: 1,
      status: "pending",
    });
  });

  it("renders nothing when the session can read none of the queues", async () => {
    const html = await render([PERMISSIONS.CUSTOMERS_READ]);

    expect(html).toBe("");
  });

  // A failed count rendered as 0 would read as "nothing to do" — the one wrong
  // answer a work queue can give.
  it("shows a failed count as unavailable rather than zero", async () => {
    mocks.listInventory.mockRejectedValue(new Error("boom"));

    const html = await render([PERMISSIONS.INVENTORY_READ]);

    expect(html).toContain("دریافت شمارش ناموفق بود");
    expect(html).toContain("آمار در دسترس نیست");
  });

  it("survives one queue failing without losing the others", async () => {
    mocks.listAdminReviews.mockRejectedValue(new Error("boom"));

    const html = await render([
      PERMISSIONS.ORDERS_READ,
      PERMISSIONS.REVIEWS_READ,
    ]);

    expect(html).toContain("/admin/orders?status=pending");
    expect(html).toContain("/admin/reviews?status=pending");
  });
});
