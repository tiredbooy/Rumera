import { beforeEach, describe, expect, it, vi } from "vitest";

import { PERMISSIONS } from "@/lib/rbac/permissions";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({
  requirePermission: mocks.requirePermission,
}));

import { requireShippingAdmin } from "./admin-only";

const session = {
  role: "staff",
  permissions: [PERMISSIONS.SHIPPING_MANAGE],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requirePermission.mockResolvedValue(session);
});

describe("requireShippingAdmin", () => {
  it("gates on shipping:manage, not role === admin", async () => {
    await expect(requireShippingAdmin()).resolves.toBe(session);
    expect(mocks.requirePermission).toHaveBeenCalledWith(
      PERMISSIONS.SHIPPING_MANAGE,
      "/admin/shipping",
    );
  });

  it("forwards the callback URL", async () => {
    await requireShippingAdmin("/admin/shipping/new");
    expect(mocks.requirePermission).toHaveBeenCalledWith(
      PERMISSIONS.SHIPPING_MANAGE,
      "/admin/shipping/new",
    );
  });
});
