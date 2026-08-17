import type { JWT } from "next-auth/jwt";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class CredentialsSignin extends Error {
    static type = "CredentialsSignin";
    type = "CredentialsSignin";
    code = "credentials";
  }
  class AuthServerError extends Error {
    constructor(
      public readonly status: number,
      public readonly code: string,
      message: string,
    ) {
      super(message);
      this.name = "AuthServerError";
    }
  }
  return {
    revokeAuthTokens: vi.fn(),
    authenticateWithPassword: vi.fn(),
    authenticateWithOtp: vi.fn(),
    serverAuth: vi.fn((handler) => handler),
    routeAuth: vi.fn((handler) => handler),
    nextAuthCall: 0,
    CredentialsSignin,
    AuthServerError,
  };
});

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
  CredentialsSignin: mocks.CredentialsSignin,
}));
vi.mock("next-auth/providers/credentials", () => ({
  default: vi.fn((config) => config),
}));
vi.mock("@/features/auth/api/server", () => ({
  AuthServerError: mocks.AuthServerError,
  authenticateWithOtp: mocks.authenticateWithOtp,
  authenticateWithPassword: mocks.authenticateWithPassword,
  refreshAuthTokens: vi.fn(),
  revokeAuthTokens: mocks.revokeAuthTokens,
}));

import {
  authorizeFailureCode,
  nodeAuthConfig,
  routeAuth,
} from "./auth";

type Authorize = (creds: Record<string, unknown>) => Promise<unknown>;

function passwordAuthorize(): Authorize {
  const provider = nodeAuthConfig(true).providers[0] as unknown as {
    authorize: Authorize;
  };
  return provider.authorize;
}

function otpAuthorize(): Authorize {
  const provider = nodeAuthConfig(true).providers[1] as unknown as {
    authorize: Authorize;
  };
  return provider.authorize;
}

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

describe("authorizeFailureCode", () => {
  it("maps rate limits, inactive accounts, credentials, and upstream errors", () => {
    expect(
      authorizeFailureCode(
        new mocks.AuthServerError(429, "TOO_MANY_REQUESTS", "slow down"),
      ),
    ).toBe("RateLimited");
    expect(
      authorizeFailureCode(
        new mocks.AuthServerError(403, "ACCOUNT_DISABLED", "disabled"),
      ),
    ).toBe("Inactive");
    expect(
      authorizeFailureCode(
        new mocks.AuthServerError(403, "FORBIDDEN", "forbidden"),
      ),
    ).toBe("Inactive");
    expect(
      authorizeFailureCode(
        new mocks.AuthServerError(401, "INVALID_CREDENTIALS", "nope"),
      ),
    ).toBe("CredentialsSignin");
    expect(
      authorizeFailureCode(
        new mocks.AuthServerError(500, "INTERNAL_ERROR", "boom"),
      ),
    ).toBe("AuthServiceError");
    expect(authorizeFailureCode(new Error("network down"))).toBe(
      "AuthServiceError",
    );
  });
});

describe("Credentials authorize failures", () => {
  beforeEach(() => {
    mocks.authenticateWithPassword.mockReset();
    mocks.authenticateWithOtp.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.mocked(console.error).mockRestore();
  });

  it("throws RateLimited instead of returning null on 429", async () => {
    mocks.authenticateWithPassword.mockRejectedValue(
      new mocks.AuthServerError(429, "TOO_MANY_REQUESTS", "too many"),
    );

    await expect(
      passwordAuthorize()({ email: "a@b.c", password: "secret" }),
    ).rejects.toMatchObject({
      type: "CredentialsSignin",
      code: "RateLimited",
    });
  });

  it("throws Inactive for a banned or disabled account", async () => {
    mocks.authenticateWithPassword.mockRejectedValue(
      new mocks.AuthServerError(403, "ACCOUNT_DISABLED", "disabled"),
    );

    await expect(
      passwordAuthorize()({ email: "a@b.c", password: "secret" }),
    ).rejects.toMatchObject({ code: "Inactive" });
  });

  it("throws CredentialsSignin for wrong password", async () => {
    mocks.authenticateWithPassword.mockRejectedValue(
      new mocks.AuthServerError(401, "INVALID_CREDENTIALS", "invalid"),
    );

    await expect(
      passwordAuthorize()({ email: "a@b.c", password: "wrong" }),
    ).rejects.toMatchObject({ code: "CredentialsSignin" });
  });

  it("throws AuthServiceError for upstream 5xx and missing tokens", async () => {
    mocks.authenticateWithPassword.mockRejectedValue(
      new mocks.AuthServerError(502, "INTERNAL_ERROR", "upstream"),
    );
    await expect(
      passwordAuthorize()({ email: "a@b.c", password: "secret" }),
    ).rejects.toMatchObject({ code: "AuthServiceError" });

    mocks.authenticateWithPassword.mockResolvedValue({ user: {} });
    await expect(
      passwordAuthorize()({ email: "a@b.c", password: "secret" }),
    ).rejects.toMatchObject({ code: "AuthServiceError" });
  });

  it("maps OTP verify failures the same way", async () => {
    mocks.authenticateWithOtp.mockRejectedValue(
      new mocks.AuthServerError(429, "TOO_MANY_REQUESTS", "too many"),
    );
    await expect(
      otpAuthorize()({ phone: "09123456789", code: "123456" }),
    ).rejects.toMatchObject({ code: "RateLimited" });

    mocks.authenticateWithOtp.mockRejectedValue(
      new mocks.AuthServerError(401, "INVALID_CREDENTIALS", "bad code"),
    );
    await expect(
      otpAuthorize()({ phone: "09123456789", code: "000000" }),
    ).rejects.toMatchObject({ code: "CredentialsSignin" });
  });
});
