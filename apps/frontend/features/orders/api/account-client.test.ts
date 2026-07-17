import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiClientError } from "@/lib/api/store-client";

import { getAccountOrderClient } from "./account-client";

afterEach(() => {
  vi.unstubAllGlobals();
});

function apiErrorResponse(status: number, code: string) {
  return new Response(
    JSON.stringify({ error: { code, message: "request failed" } }),
    {
      status,
      headers: { "Content-Type": "application/json" },
    },
  );
}

describe("getAccountOrderClient", () => {
  it("maps a typed 404 response to a missing order", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(apiErrorResponse(404, "NOT_FOUND")),
    );

    await expect(getAccountOrderClient(404)).resolves.toBeNull();
  });

  it("preserves non-404 failures for the retry state", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(apiErrorResponse(503, "UNAVAILABLE")),
    );

    let thrown: unknown;
    try {
      await getAccountOrderClient(503);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(ApiClientError);
    expect(thrown).toMatchObject({ status: 503, code: "UNAVAILABLE" });
  });
});
