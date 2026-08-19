import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { ApiError } from "./errors";
import {
  getSafeApiErrorContext,
  isApiNotFoundError,
  isApiNotModifiedError,
} from "./error-semantics";
import { publicRequest } from "./public";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("API error semantics", () => {
  it("recognizes only typed API 404 errors as not found", () => {
    expect(isApiNotFoundError(new ApiError(404, "NOT_FOUND", "missing"))).toBe(
      true,
    );
    expect(isApiNotFoundError(new ApiError(503, "UNAVAILABLE", "down"))).toBe(
      false,
    );
    expect(isApiNotFoundError({ status: 404 })).toBe(false);
  });

  it("recognizes a typed 304 as not-modified, not as a parse failure", () => {
    expect(
      isApiNotModifiedError(new ApiError(304, "NOT_MODIFIED", "Not Modified")),
    ).toBe(true);
    expect(isApiNotModifiedError(new ApiError(304, "UNKNOWN", "Not Modified"))).toBe(
      false,
    );
    expect(isApiNotModifiedError(new ApiError(404, "NOT_FOUND", "missing"))).toBe(
      false,
    );
  });

  it("classifies the real error thrown by publicRequest", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: { code: "NOT_FOUND", message: "missing" },
          }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          },
        ),
      ),
    );

    let thrown: unknown;
    try {
      await publicRequest("/products/missing");
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(ApiError);
    expect(isApiNotFoundError(thrown)).toBe(true);
    expect(thrown).toMatchObject({ status: 404, code: "NOT_FOUND" });
  });

  it("does not parse a 304 body and throws NOT_MODIFIED", async () => {
    const json = vi.fn(() => Promise.reject(new SyntaxError("Unexpected end of JSON")));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 304,
        statusText: "Not Modified",
        json,
      }),
    );

    await expect(publicRequest("/products/1")).rejects.toMatchObject({
      name: "ApiError",
      status: 304,
      code: "NOT_MODIFIED",
    });
    expect(json).not.toHaveBeenCalled();
  });

  it("omits messages and request details from build-log context", () => {
    expect(
      getSafeApiErrorContext(
        new ApiError(503, "UPSTREAM_UNAVAILABLE", "token=secret"),
      ),
    ).toEqual({
      name: "ApiError",
      status: 503,
      code: "UPSTREAM_UNAVAILABLE",
    });
    expect(
      getSafeApiErrorContext(new TypeError("https://user:secret@example.com")),
    ).toEqual({ name: "TypeError" });
  });
});
