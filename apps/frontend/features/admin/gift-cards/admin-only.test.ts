import { beforeEach, describe, expect, it, vi } from "vitest";

import { PERMISSIONS } from "@/lib/rbac/permissions";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({
  requirePermission: mocks.requirePermission,
}));

import { requireGiftCardAdmin } from "./admin-only";

const session = {
  role: "staff",
  permissions: [PERMISSIONS.GIFT_CARDS_ISSUE],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requirePermission.mockResolvedValue(session);
});

describe("requireGiftCardAdmin", () => {
  it("gates on gift-cards:issue, not role === admin", async () => {
    await expect(requireGiftCardAdmin()).resolves.toBe(session);
    expect(mocks.requirePermission).toHaveBeenCalledWith(
      PERMISSIONS.GIFT_CARDS_ISSUE,
      "/admin/gift-cards",
    );
  });

  it("forwards the callback URL", async () => {
    await requireGiftCardAdmin("/admin/gift-cards?issued=1");
    expect(mocks.requirePermission).toHaveBeenCalledWith(
      PERMISSIONS.GIFT_CARDS_ISSUE,
      "/admin/gift-cards?issued=1",
    );
  });
});
