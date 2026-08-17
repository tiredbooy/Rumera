import { beforeEach, describe, expect, it, vi } from "vitest";

import { PERMISSIONS } from "@/lib/rbac/permissions";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({
  requirePermission: mocks.requirePermission,
}));

import { requireTagAdmin } from "./admin-only";

const session = {
  role: "staff",
  permissions: [PERMISSIONS.TAGS_MANAGE],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requirePermission.mockResolvedValue(session);
});

describe("requireTagAdmin", () => {
  it("gates on tags:manage, not role === admin", async () => {
    await expect(requireTagAdmin()).resolves.toBe(session);
    expect(mocks.requirePermission).toHaveBeenCalledWith(
      PERMISSIONS.TAGS_MANAGE,
      "/admin/tags",
    );
  });

  it("forwards the callback URL", async () => {
    await requireTagAdmin("/admin/tags/new");
    expect(mocks.requirePermission).toHaveBeenCalledWith(
      PERMISSIONS.TAGS_MANAGE,
      "/admin/tags/new",
    );
  });
});
