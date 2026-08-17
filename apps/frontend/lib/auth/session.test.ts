import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  getLiveAccount: vi.fn(),
  getToken: vi.fn(),
  headers: vi.fn(async () => new Headers()),
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));

vi.mock("server-only", () => ({}));
vi.mock("./auth", () => ({ auth: mocks.auth }));
vi.mock("./live-account", () => ({ getLiveAccount: mocks.getLiveAccount }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("next-auth/jwt", () => ({ getToken: mocks.getToken }));

import { authConfig } from "./auth.config";
import {
  getSession,
  LiveAuthorizationUnavailableError,
  requireStaff,
} from "./session";

const publicSession = {
  role: "customer" as const,
  permissions: [],
  user: { id: "stale-id", email: "old@example.com", name: "Old" },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue(publicSession);
  mocks.getToken.mockResolvedValue({ accessToken: "access-token" });
});

describe("session callback", () => {
  it("does not project the Go access JWT onto the public session", async () => {
    const sessionCb = authConfig.callbacks?.session;
    expect(sessionCb).toBeTypeOf("function");

    const session = await sessionCb?.({
      session: {
        user: { name: "Ada", email: "ada@example.com" },
        expires: "2099-01-01T00:00:00.000Z",
      },
      token: {
        accessToken: "go-jwt-must-not-leak",
        refreshToken: "refresh-must-not-leak",
        role: "admin",
        user: { id: "user-1" },
      },
    } as never);

    expect(session).not.toHaveProperty("accessToken");
    expect(session).not.toHaveProperty("refreshToken");
    expect(session).toMatchObject({
      role: "admin",
      user: { id: "user-1" },
    });
    expect(
      Array.isArray((session as { permissions?: unknown }).permissions),
    ).toBe(true);
  });
});

describe("getSession", () => {
  it("does not expose the Go access JWT on the public session", async () => {
    const session = await getSession();
    expect(session).not.toHaveProperty("accessToken");
    expect(session).toMatchObject({
      role: "customer",
      user: { id: "stale-id" },
    });
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
    expect(session).not.toHaveProperty("accessToken");
    expect(mocks.getLiveAccount).toHaveBeenCalledWith("access-token");
  });

  it("reads the Go JWT from the encrypted Auth.js token, not the public session", async () => {
    mocks.auth.mockResolvedValue({
      ...publicSession,
      accessToken: "must-not-use-session-field",
    });
    mocks.getToken.mockResolvedValue({ accessToken: "jwt-access-token" });
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

    await requireStaff();

    expect(mocks.getToken).toHaveBeenCalled();
    expect(mocks.getLiveAccount).toHaveBeenCalledWith("jwt-access-token");
    expect(mocks.getLiveAccount).not.toHaveBeenCalledWith(
      "must-not-use-session-field",
    );
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
