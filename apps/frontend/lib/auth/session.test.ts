import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  getLiveAccount: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));

vi.mock("server-only", () => ({}));
vi.mock("./auth", () => ({ auth: mocks.auth }));
vi.mock("./live-account", () => ({ getLiveAccount: mocks.getLiveAccount }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import { LiveAuthorizationUnavailableError, requireStaff } from "./session";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({
    accessToken: "access-token",
    role: "customer",
    permissions: [],
    user: { id: "stale-id", email: "old@example.com", name: "Old" },
  });
});

describe("requireStaff", () => {
  it("overlays the live promoted admin identity and capabilities", async () => {
    mocks.getLiveAccount.mockResolvedValue({
      status: "active",
      profile: {
        user_id: "live-id",
        first_name: "Live",
        last_name: "Admin",
        email: "admin@example.com",
        role: "admin",
        created_at: "2026-07-28T10:00:00Z",
      },
    });

    const session = await requireStaff();

    expect(session.role).toBe("admin");
    expect(session.permissions.length).toBeGreaterThan(0);
    expect(session.user).toMatchObject({
      id: "live-id",
      email: "admin@example.com",
      name: "Live Admin",
    });
  });

  it("redirects a demoted or revoked account", async () => {
    mocks.getLiveAccount.mockResolvedValue({ status: "revoked" });

    await expect(requireStaff()).rejects.toThrow("redirect:/forbidden");
    expect(mocks.redirect).toHaveBeenCalledWith("/forbidden");
  });

  it("does not misreport an unavailable authorization check as forbidden", async () => {
    mocks.getLiveAccount.mockResolvedValue({ status: "unavailable" });

    await expect(requireStaff()).rejects.toBeInstanceOf(
      LiveAuthorizationUnavailableError,
    );
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
