import { beforeEach, describe, expect, it, vi } from "vitest";

import { PERMISSIONS } from "@/lib/rbac/permissions";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({
  requirePermission: mocks.requirePermission,
}));

import { requirePaymentAdmin } from "./admin-only";

const session = {
  role: "staff",
  permissions: [PERMISSIONS.PAYMENTS_READ],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requirePermission.mockResolvedValue(session);
});

describe("requirePaymentAdmin", () => {
  it("gates on payments:read, not role === admin", async () => {
    await expect(requirePaymentAdmin()).resolves.toBe(session);
    expect(mocks.requirePermission).toHaveBeenCalledWith(
      PERMISSIONS.PAYMENTS_READ,
      "/admin/payments",
    );
  });

  it("forwards the callback URL", async () => {
    await requirePaymentAdmin("/admin/payments/12");
    expect(mocks.requirePermission).toHaveBeenCalledWith(
      PERMISSIONS.PAYMENTS_READ,
      "/admin/payments/12",
    );
  });
});
