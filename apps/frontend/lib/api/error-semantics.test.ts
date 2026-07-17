import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { ApiError } from "./errors";
import { getSafeApiErrorContext, isApiNotFoundError } from "./error-semantics";
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
