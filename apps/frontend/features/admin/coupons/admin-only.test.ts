import { beforeEach, describe, expect, it, vi } from "vitest";

import { PERMISSIONS } from "@/lib/rbac/permissions";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({
  requirePermission: mocks.requirePermission,
}));

import { requireCouponAdmin } from "./admin-only";

const session = {
  role: "staff",
  permissions: [PERMISSIONS.COUPONS_MANAGE],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requirePermission.mockResolvedValue(session);
});

describe("requireCouponAdmin", () => {
  it("gates on coupons:manage, not role === admin", async () => {
    await expect(requireCouponAdmin()).resolves.toBe(session);
    expect(mocks.requirePermission).toHaveBeenCalledWith(
      PERMISSIONS.COUPONS_MANAGE,
      "/admin/coupons",
    );
  });

  it("forwards the callback URL", async () => {
    await requireCouponAdmin("/admin/coupons/new");
    expect(mocks.requirePermission).toHaveBeenCalledWith(
      PERMISSIONS.COUPONS_MANAGE,
      "/admin/coupons/new",
    );
  });
});
