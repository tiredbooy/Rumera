import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  users: vi.fn(),
  tags: vi.fn(),
  coupons: vi.fn(),
  zones: vi.fn(),
  payments: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/features/customers/api", () => ({ listUsers: mocks.users }));
vi.mock("@/features/catalog/tags/api/public", () => ({ listTags: mocks.tags }));
vi.mock("@/features/coupons/api/server", () => ({
  listAdminCoupons: mocks.coupons,
}));
vi.mock("@/features/shipping/api/server", () => ({
  listShippingZones: mocks.zones,
}));
vi.mock("@/features/payments/api/admin", () => ({
  listAdminPayments: mocks.payments,
}));

import { PERMISSIONS } from "@/lib/rbac/permissions";
import { AdminModuleOverview } from "./admin-module-overview";

function page(total: number) {
  return {
    results: [],
    pagination: {
      page: 1,
      limit: 1,
      total_items: total,
      total_pages: Math.max(1, total),
      has_next: total > 1,
      has_prev: false,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.users.mockResolvedValue(page(23));
  mocks.tags.mockResolvedValue(page(17));
  mocks.coupons.mockResolvedValue(page(4));
  mocks.zones.mockResolvedValue(page(3));
  mocks.payments.mockResolvedValue(page(2));
});

describe("AdminModuleOverview", () => {
  it("renders truthful counts and direct actions from domain APIs", async () => {
    const permissions = [
      PERMISSIONS.CUSTOMERS_READ,
      PERMISSIONS.TAGS_MANAGE,
      PERMISSIONS.COUPONS_MANAGE,
      PERMISSIONS.SHIPPING_MANAGE,
      PERMISSIONS.PAYMENTS_READ,
      PERMISSIONS.GIFT_CARDS_ISSUE,
    ];

    const html = renderToStaticMarkup(
      await AdminModuleOverview({ permissions }),
    );

    expect(html).toContain('aria-label="کاربران: ۲۳"');
    expect(html).toContain('href="/admin/customers"');
    expect(html).toContain('aria-label="پرداخت‌های در انتظار: ۲"');
    expect(html).toContain('href="/admin/payments?status=pending"');
    expect(html).toContain('aria-label="کدهای تخفیف فعال: ۴"');
    expect(html).toContain('href="/admin/coupons?status=current"');
    expect(html).toContain('aria-label="کارت هدیه: صدور"');
    expect(html).toContain('href="/admin/gift-cards"');
    expect(mocks.coupons).toHaveBeenCalledWith({
      page: 1,
      limit: 1,
      active_only: true,
    });
    expect(mocks.payments).toHaveBeenCalledWith({
      page: 1,
      limit: 1,
      status: "pending",
    });
  });

  it("shows unavailable instead of a fabricated zero and skips forbidden APIs", async () => {
    mocks.payments.mockRejectedValue(new Error("offline"));

    const html = renderToStaticMarkup(
      await AdminModuleOverview({
        permissions: [PERMISSIONS.PAYMENTS_READ],
      }),
    );

    expect(html).toContain(
      'aria-label="پرداخت‌های در انتظار: آمار در دسترس نیست"',
    );
    expect(html).toContain("دریافت شمارش ناموفق بود");
    expect(mocks.users).not.toHaveBeenCalled();
    expect(mocks.tags).not.toHaveBeenCalled();
    expect(mocks.coupons).not.toHaveBeenCalled();
    expect(mocks.zones).not.toHaveBeenCalled();
  });
});
