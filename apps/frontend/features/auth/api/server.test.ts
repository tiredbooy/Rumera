import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { revokeAuthTokens } from "./server";

describe("revokeAuthTokens", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("posts the refresh token and accepts a 204 response", async () => {
    const timeoutSignal = new AbortController().signal;
    const timeoutSpy = vi
      .spyOn(AbortSignal, "timeout")
      .mockReturnValue(timeoutSignal);
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 204,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await revokeAuthTokens({ refresh_token: "refresh-token" });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8080/api/v1/auth/logout",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: "refresh-token" }),
        signal: timeoutSignal,
      },
    );
    expect(timeoutSpy).toHaveBeenCalledWith(5_000);
  });

  it("preserves backend error details", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json(
            { error: { code: "INVALID_TOKEN", message: "invalid token" } },
            { status: 401 },
          ),
        ),
    );

    await expect(
      revokeAuthTokens({ refresh_token: "invalid" }),
    ).rejects.toEqual(
      expect.objectContaining({
        status: 401,
        code: "INVALID_TOKEN",
        message: "invalid token",
      }),
    );
  });
});
