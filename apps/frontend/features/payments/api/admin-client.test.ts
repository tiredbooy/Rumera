import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getAdminPaymentByTransactionIDClient,
  listAdminPaymentsClient,
} from "./admin-client";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("payment admin client", () => {
  it("preserves the top-level paginated response and list filters", async () => {
    const payload = {
      results: [],
      pagination: {
        page: 2,
        limit: 20,
        total_items: 21,
        total_pages: 2,
        has_next: false,
        has_prev: true,
      },
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      listAdminPaymentsClient({
        page: 2,
        limit: 20,
        status: "failed",
        order_id: 42,
      }),
    ).resolves.toEqual(payload);
    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).toContain("/api/admin/admin/payments?");
    expect(url).toContain("status=failed");
    expect(url).toContain("order_id=42");
  });

  it("encodes a gateway transaction id in the lookup path", async () => {
    const payment = {
      id: 1,
      amount: "10",
      currency: "IRT",
      status: "succeeded",
      payment_method: "gateway",
      transaction_id: "gateway id",
      created_at: "2026-07-29T12:00:00Z",
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: payment }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      getAdminPaymentByTransactionIDClient("gateway id"),
    ).resolves.toEqual(payment);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/admin/payments/by-transaction/gateway%20id",
    );
  });
});
