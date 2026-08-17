import { afterEach, describe, expect, it, vi } from "vitest";

import { validateResetToken } from "./client";

describe("validateResetToken", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("GETs the public validate path with the encoded token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({ data: { valid: true } }, { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(validateResetToken("a b/+")).resolves.toEqual({ valid: true });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/public/auth/password/validate?token=a%20b%2F%2B",
      expect.objectContaining({ method: "GET", cache: "no-store" }),
    );
  });

  it("maps invalid and expired envelopes to the same unusable result", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json(
          { error: { code: "INVALID_TOKEN", message: "token is invalid" } },
          { status: 401 },
        ),
      )
      .mockResolvedValueOnce(
        Response.json(
          { error: { code: "EXPIRED_TOKEN", message: "token has expired" } },
          { status: 401 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(validateResetToken("bad")).resolves.toEqual({ valid: false });
    await expect(validateResetToken("old")).resolves.toEqual({ valid: false });
  });

  it("rethrows upstream failures so the form does not fake an invalid token", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json(
          { error: { code: "INTERNAL_ERROR", message: "boom" } },
          { status: 500 },
        ),
      ),
    );

    await expect(validateResetToken("maybe")).rejects.toEqual(
      expect.objectContaining({
        name: "AuthClientError",
        status: 500,
        code: "INTERNAL_ERROR",
      }),
    );
  });
});
