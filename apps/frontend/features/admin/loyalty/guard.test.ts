import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/errors";

const mocks = vi.hoisted(() => ({
  getLoyaltyProgramme: vi.fn(),
  apiFetch: vi.fn(),
  resolveLivePermissions: vi.fn(),
  redirect: vi.fn((href: string) => {
    throw new Error(`NEXT_REDIRECT:${href}`);
  }),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("./api/server", () => ({
  getLoyaltyProgramme: mocks.getLoyaltyProgramme,
}));
vi.mock("@/lib/api/client", () => ({ apiFetch: mocks.apiFetch }));
vi.mock("@/lib/rbac/live-permissions", () => ({
  resolveLivePermissions: mocks.resolveLivePermissions,
}));

import { canAdjustLoyalty, requireLoyaltyEnabled } from "./guard";

const programme = { enabled: true } as Awaited<
  ReturnType<typeof import("./api/server").getLoyaltyProgramme>
>;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getLoyaltyProgramme.mockResolvedValue(programme);
});

describe("loyalty kill switch guard", () => {
  it("lets the section through while the programme is on", async () => {
    await expect(requireLoyaltyEnabled()).resolves.toBeUndefined();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("sends a closed section to the only screen that reopens it", async () => {
    mocks.getLoyaltyProgramme.mockResolvedValue({
      ...programme,
      enabled: false,
    });

    await expect(requireLoyaltyEnabled()).rejects.toThrow(
      "NEXT_REDIRECT:/admin/loyalty/programme",
    );
  });

  // A flaky programme GET must not lock operators out of the section; the
  // backend still 409s every write while the switch is off.
  it.each([new Error("offline"), new ApiError(500, "INTERNAL", "boom")])(
    "stays open when the programme read fails (%s)",
    async (error) => {
      mocks.getLoyaltyProgramme.mockRejectedValue(error);

      await expect(requireLoyaltyEnabled()).resolves.toBeUndefined();
      expect(mocks.redirect).not.toHaveBeenCalled();
    },
  );
});

describe("loyalty mint capability", () => {
  beforeEach(() => {
    mocks.apiFetch.mockResolvedValue({ role: "staff" });
  });

  it("opens the mint control when the live matrix grants loyalty:adjust", async () => {
    mocks.resolveLivePermissions.mockResolvedValue([
      "customers:read",
      "loyalty:adjust",
    ]);

    await expect(canAdjustLoyalty()).resolves.toBe(true);
    expect(mocks.resolveLivePermissions).toHaveBeenCalledWith("staff");
  });

  it("hides it for an operator the matrix does not grant", async () => {
    mocks.resolveLivePermissions.mockResolvedValue([
      "customers:read",
      "customers:write",
    ]);

    await expect(canAdjustLoyalty()).resolves.toBe(false);
  });

  // Fails closed: an unreadable identity must never open a minting surface.
  it("hides it when the operator cannot be identified", async () => {
    mocks.apiFetch.mockRejectedValue(new ApiError(401, "UNAUTHORIZED", "no"));

    await expect(canAdjustLoyalty()).resolves.toBe(false);
    expect(mocks.resolveLivePermissions).not.toHaveBeenCalled();
  });
});
