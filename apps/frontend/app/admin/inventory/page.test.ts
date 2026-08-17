import { beforeEach, describe, expect, it, vi } from "vitest";

import { PERMISSIONS } from "@/lib/rbac/permissions";

const mocks = vi.hoisted(() => ({
  can: vi.fn(() => true),
  requirePermission: vi.fn().mockResolvedValue({ role: "admin" }),
  view: vi.fn(() => null),
}));

vi.mock("@/features/admin/inventory/components/inventory-list-view", () => ({
  InventoryListView: mocks.view,
}));
vi.mock("@/lib/auth/session", () => ({
  requirePermission: mocks.requirePermission,
}));
vi.mock("@/lib/rbac/can", () => ({ can: mocks.can }));

import AdminInventoryPage from "./page";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requirePermission.mockResolvedValue({ role: "admin" });
  mocks.can.mockReturnValue(true);
});

describe("admin inventory list route", () => {
  it("requires inventory read and forwards URL filters to the list view", async () => {
    const searchParams = { q: "wine", page: "2", low_stock: "true" };
    const element = await AdminInventoryPage({
      searchParams: Promise.resolve(searchParams),
    });

    expect(mocks.requirePermission).toHaveBeenCalledWith(
      PERMISSIONS.INVENTORY_READ,
    );
    expect(element.type).toBe(mocks.view);
    expect(element.props).toEqual({
      searchParams,
      canWrite: true,
    });
  });

  it("does not open the board when the permission guard rejects", async () => {
    mocks.requirePermission.mockRejectedValue(new Error("NEXT_REDIRECT"));

    await expect(
      AdminInventoryPage({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.view).not.toHaveBeenCalled();
  });
});
