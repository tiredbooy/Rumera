import { afterEach, describe, expect, it, vi } from "vitest";

import { listWalletTransactions } from "./api";

const row = {
  id: 7,
  amount: "15000.00",
  type: "deposit" as const,
  status: "completed" as const,
  created_at: "2026-08-16T12:00:00Z",
};

function pagination(page: number, totalItems = 1) {
  return {
    page,
    limit: 20,
    total_items: totalItems,
    total_pages: Math.max(1, Math.ceil(totalItems / 20)),
    has_next: page * 20 < totalItems,
    has_prev: page > 1,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("listWalletTransactions (PR-035c)", () => {
  it("reads the top-level {results, pagination} envelope", async () => {
    const payload = { results: [row], pagination: pagination(1, 1) };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(listWalletTransactions()).resolves.toEqual(payload);

    const [url] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toBe("/api/store/wallet/transactions");
  });

  it("forwards page and limit query keys", async () => {
    const payload = { results: [], pagination: pagination(2, 25) };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      listWalletTransactions({ page: 2, limit: 20 }),
    ).resolves.toEqual(payload);

    const [url] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toBe("/api/store/wallet/transactions?page=2&limit=20");
  });
});
