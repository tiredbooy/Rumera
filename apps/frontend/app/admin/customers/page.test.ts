import { beforeEach, describe, expect, it, vi } from "vitest";

import { PERMISSIONS } from "@/lib/rbac/permissions";

const mocks = vi.hoisted(() => ({
  can: vi.fn(() => true),
  requirePermission: vi.fn().mockResolvedValue({ role: "admin" }),
  view: vi.fn(() => null),
}));

vi.mock("@/features/admin/customers/components/customers-view", () => ({
  CustomersView: mocks.view,
}));
vi.mock("@/lib/auth/session", () => ({
  requirePermission: mocks.requirePermission,
}));
vi.mock("@/lib/rbac/can", () => ({ can: mocks.can }));

import AdminCustomersPage from "./page";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requirePermission.mockResolvedValue({ role: "admin" });
  mocks.can.mockReturnValue(true);
});

describe("admin customers list route", () => {
  it("requires customers:read and forwards write capability", async () => {
    const element = await AdminCustomersPage({
      searchParams: Promise.resolve({}),
    });

    expect(mocks.requirePermission).toHaveBeenCalledWith(
      PERMISSIONS.CUSTOMERS_READ,
    );
    expect(mocks.can).toHaveBeenCalledWith(
      { role: "admin" },
      PERMISSIONS.CUSTOMERS_WRITE,
    );
    expect(element.type).toBe(mocks.view);
    expect(element.props).toEqual({
      searchParams: {},
      canWrite: true,
    });
  });

  it("hides create when the operator lacks customers:write", async () => {
    mocks.can.mockReturnValue(false);

    const element = await AdminCustomersPage({
      searchParams: Promise.resolve({ q: "mina" }),
    });

    expect(element.props).toEqual({
      searchParams: { q: "mina" },
      canWrite: false,
    });
  });
});
