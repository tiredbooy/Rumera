import { beforeEach, describe, expect, it, vi } from "vitest";

import { PERMISSIONS } from "@/lib/rbac/permissions";

const mocks = vi.hoisted(() => ({
  can: vi.fn(() => true),
  requirePermission: vi.fn().mockResolvedValue({ role: "staff" }),
  view: vi.fn(() => null),
}));

vi.mock("@/features/admin/categories/components/category-editor-view", () => ({
  CategoryEditView: mocks.view,
}));
vi.mock("@/lib/auth/session", () => ({
  requirePermission: mocks.requirePermission,
}));
vi.mock("@/lib/rbac/can", () => ({ can: mocks.can }));

import AdminEditCategoryPage from "./page";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requirePermission.mockResolvedValue({ role: "staff" });
  mocks.can.mockReturnValue(true);
});

describe("admin category edit route", () => {
  it("requires products:read and forwards write capability", async () => {
    const element = await AdminEditCategoryPage({
      params: Promise.resolve({ id: "11" }),
    });

    expect(mocks.requirePermission).toHaveBeenCalledWith(
      PERMISSIONS.PRODUCTS_READ,
    );
    expect(mocks.can).toHaveBeenCalledWith(
      { role: "staff" },
      PERMISSIONS.PRODUCTS_WRITE,
    );
    expect(element.type).toBe(mocks.view);
    expect(element.props).toEqual({
      id: "11",
      canWrite: true,
    });
  });

  it("keeps the page readable without products:write", async () => {
    mocks.can.mockReturnValue(false);

    const element = await AdminEditCategoryPage({
      params: Promise.resolve({ id: "11" }),
    });

    expect(mocks.requirePermission).toHaveBeenCalledWith(
      PERMISSIONS.PRODUCTS_READ,
    );
    expect(element.props).toEqual({
      id: "11",
      canWrite: false,
    });
  });
});
