import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiClientError } from "@/lib/api/store-client";

import { getAccountOrderClient, payAccountOrderClient } from "./account-client";

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

describe("payAccountOrderClient", () => {
  it("POSTs /orders/:id/pay and returns the API order as-is", async () => {
    const data = {
      id: 7,
      status: "pending",
      payment_method: "gateway",
      payment_url: "https://pay.example.com/start?transaction_id=abc",
      transaction_id: "abc",
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(payAccountOrderClient(7, "idem-pay-1")).resolves.toEqual(data);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/store/orders/7/pay",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Idempotency-Key": "idem-pay-1",
        }),
      }),
    );
  });

  it("does not invent a payment_url when the API omits one", async () => {
    const data = {
      id: 8,
      status: "pending",
      payment_method: "bank_transfer",
      transaction_id: "tx-offline",
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ data }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    await expect(payAccountOrderClient(8)).resolves.toEqual(data);
  });
});
