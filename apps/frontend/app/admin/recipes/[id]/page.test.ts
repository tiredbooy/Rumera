import { beforeEach, describe, expect, it, vi } from "vitest";

import { PERMISSIONS } from "@/lib/rbac/permissions";

const mocks = vi.hoisted(() => ({
  can: vi.fn(() => true),
  requirePermission: vi.fn().mockResolvedValue({ role: "staff" }),
  view: vi.fn(() => null),
}));

vi.mock("@/features/admin/recipes/components/recipe-editor-view", () => ({
  RecipeEditView: mocks.view,
}));
vi.mock("@/lib/auth/session", () => ({
  requirePermission: mocks.requirePermission,
}));
vi.mock("@/lib/rbac/can", () => ({ can: mocks.can }));

import AdminEditRecipePage from "./page";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requirePermission.mockResolvedValue({ role: "staff" });
  mocks.can.mockReturnValue(true);
});

describe("admin recipe edit route", () => {
  it("requires recipes:read and forwards write capability", async () => {
    const element = await AdminEditRecipePage({
      params: Promise.resolve({ id: "7" }),
    });

    expect(mocks.requirePermission).toHaveBeenCalledWith(
      PERMISSIONS.RECIPES_READ,
    );
    expect(mocks.can).toHaveBeenCalledWith(
      { role: "staff" },
      PERMISSIONS.RECIPES_WRITE,
    );
    expect(element.type).toBe(mocks.view);
    expect(element.props).toEqual({
      id: "7",
      canWrite: true,
    });
  });

  it("keeps the page readable without recipes:write", async () => {
    mocks.can.mockReturnValue(false);

    const element = await AdminEditRecipePage({
      params: Promise.resolve({ id: "7" }),
    });

    expect(mocks.requirePermission).toHaveBeenCalledWith(
      PERMISSIONS.RECIPES_READ,
    );
    expect(element.props).toEqual({
      id: "7",
      canWrite: false,
    });
  });
});
