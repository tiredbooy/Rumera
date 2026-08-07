import type { JWT } from "next-auth/jwt";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  revokeAuthTokens: vi.fn(),
  serverAuth: vi.fn((handler) => handler),
  routeAuth: vi.fn((handler) => handler),
  nextAuthCall: 0,
}));

vi.mock("next-auth", () => ({
  default: vi.fn(() => {
    const auth = mocks.nextAuthCall++ === 0 ? mocks.serverAuth : mocks.routeAuth;
    return {
      handlers: {},
      auth,
      signIn: vi.fn(),
      signOut: vi.fn(),
    };
  }),
}));
vi.mock("next-auth/providers/credentials", () => ({
  default: vi.fn((config) => config),
}));
vi.mock("@/features/auth/api/server", () => ({
  AuthServerError: class AuthServerError extends Error {},
  authenticateWithOtp: vi.fn(),
  authenticateWithPassword: vi.fn(),
  refreshAuthTokens: vi.fn(),
  revokeAuthTokens: mocks.revokeAuthTokens,
}));

import { nodeAuthConfig, routeAuth } from "./auth";

describe("Auth.js sign-out event", () => {
  beforeEach(() => {
    mocks.revokeAuthTokens.mockReset();
  });

  it("revokes the server-only backend refresh token", async () => {
    const signOut = nodeAuthConfig(true).events?.signOut;
    expect(signOut).toBeTypeOf("function");

    await signOut?.({
      token: { refreshToken: "refresh-token" } as JWT,
    });

    expect(mocks.revokeAuthTokens).toHaveBeenCalledWith({
      refresh_token: "refresh-token",
    });
  });

  it("does nothing when the session has no refresh token", async () => {
    const signOut = nodeAuthConfig(true).events?.signOut;

    await signOut?.({ token: {} as JWT });

    expect(mocks.revokeAuthTokens).not.toHaveBeenCalled();
  });

  it("exports a synchronous route-handler wrapper", () => {
    const handler = vi.fn();

    expect(routeAuth).toBe(mocks.routeAuth);
    expect(routeAuth(handler)).toBe(handler);
  });
});
