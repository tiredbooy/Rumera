import { afterEach, describe, expect, it, vi } from "vitest";

import { listLoyaltyTransactions } from "./api";

const row = {
  id: 7,
  delta: 50,
  reason: "order_paid" as const,
  ref_type: "order",
  ref_id: "99",
  created_at: "2026-08-16T12:00:00Z",
};

function pagination(page: number, totalItems = 1) {
  return {
    page,
    limit: 20,
    total_items: totalItems,
    total_pages: 1,
    has_next: false,
    has_prev: page > 1,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("listLoyaltyTransactions (PR-003j)", () => {
  it("reads the top-level {results, pagination} envelope", async () => {
    const payload = { results: [row], pagination: pagination(1, 1) };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(listLoyaltyTransactions()).resolves.toEqual(payload);

    const [url] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toBe("/api/store/loyalty/transactions");
  });

  it("forwards page and limit query keys", async () => {
    const payload = { results: [], pagination: pagination(2, 0) };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      listLoyaltyTransactions({ page: 2, limit: 20 }),
    ).resolves.toEqual(payload);

    const [url] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toBe("/api/store/loyalty/transactions?page=2&limit=20");
  });

  it("does not collapse a 400 to an empty list", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { code: "INVALID_QUERY", message: "invalid query parameters" },
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(listLoyaltyTransactions({ limit: 200 })).rejects.toMatchObject({
      status: 400,
      code: "INVALID_QUERY",
    });
  });
});
