import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AdminOrderClientError,
  listAdminOrdersClient,
  refundAdminOrderClient,
} from "./admin-client";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("listAdminOrdersClient", () => {
  it("sends status, paid_at bounds, and user_id on GET /admin/orders", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            results: [],
            pagination: {
              page: 2,
              limit: 50,
              total_items: 0,
              total_pages: 1,
              has_next: false,
              has_prev: true,
            },
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await listAdminOrdersClient({
      page: 2,
      limit: 50,
      status: "paid",
      user_id: 7,
      paid_from: "2026-08-01T00:00:00Z",
      paid_to: "2026-08-16T23:59:59Z",
      sortBy: "created_at",
      orderBy: "desc",
    });

    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url.startsWith("/api/admin/admin/orders?")).toBe(true);
    const params = new URL(url, "http://admin.local").searchParams;
    expect(params.get("status")).toBe("paid");
    expect(params.get("user_id")).toBe("7");
    expect(params.get("paid_from")).toBe("2026-08-01T00:00:00Z");
    expect(params.get("paid_to")).toBe("2026-08-16T23:59:59Z");
    expect(params.get("page")).toBe("2");
    expect(params.get("limit")).toBe("50");
  });
});

describe("refundAdminOrderClient", () => {
  it("POSTs /admin/orders/:id/refund and returns the API order", async () => {
    const data = {
      id: 42,
      status: "refunded",
      payment_method: "wallet",
      total_amount: 113,
      item_count: 0,
      created_at: "2026-06-11T10:00:00Z",
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(refundAdminOrderClient(42)).resolves.toEqual(data);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/admin/orders/42/refund",
      expect.objectContaining({ method: "POST" }),
    );
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.body).toBeUndefined();
  });

  it("surfaces a 409 as AdminOrderClientError without inventing success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              code: "CONFLICT",
              message: "order is already refunded",
            },
          }),
          { status: 409, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    await expect(refundAdminOrderClient(42)).rejects.toMatchObject({
      name: "AdminOrderClientError",
      status: 409,
      code: "CONFLICT",
      message: "order is already refunded",
    });
    await expect(refundAdminOrderClient(42)).rejects.toBeInstanceOf(
      AdminOrderClientError,
    );
  });
});
