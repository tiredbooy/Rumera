import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ apiFetch: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/api/client", () => ({ apiFetch: mocks.apiFetch }));

import { listAdminCoupons } from "@/features/coupons/api/server";
import { listShippingZones } from "@/features/shipping/api/server";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.apiFetch.mockResolvedValue({
    results: [],
    pagination: {
      page: 1,
      limit: 1,
      total_items: 0,
      total_pages: 1,
      has_next: false,
      has_prev: false,
    },
  });
});

describe("admin module server APIs", () => {
  it("uses the admin coupon read with current-only filters", async () => {
    await listAdminCoupons({ page: 1, limit: 1, active_only: true });
    expect(mocks.apiFetch).toHaveBeenCalledWith(
      "/admin/coupons?page=1&limit=1&active_only=true",
    );
  });

  it("uses the supported shipping-zone read with active filtering", async () => {
    await listShippingZones({ page: 1, limit: 1, is_active: true });
    expect(mocks.apiFetch).toHaveBeenCalledWith(
      "/shipping/zones?page=1&limit=1&is_active=true",
    );
  });
});
