import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getFeaturedBrands } from "./api";

const hennessy = {
  id: 3,
  title: "  Hennessy  ",
  slug: "hennessy",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const emptyTitle = {
  id: 4,
  title: "   ",
  slug: "blank",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const invalidId = {
  id: 0,
  title: "Ghost",
  slug: "ghost",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

function brandPage(results: unknown[]) {
  return {
    results,
    pagination: {
      page: 1,
      limit: 16,
      total_items: results.length,
      total_pages: 1,
      has_next: false,
      has_prev: false,
    },
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getFeaturedBrands", () => {
  it("maps live brands and requests the titled cache-tagged list", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(brandPage([hennessy])));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getFeaturedBrands()).resolves.toEqual([
      { id: 3, title: "Hennessy", slug: "hennessy" },
    ]);

    const [url, options] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toContain("/api/v1/brands?");
    expect(String(url)).toContain("limit=16");
    expect(String(url)).toContain("sortBy=title");
    expect(String(url)).toContain("orderBy=asc");
    expect(options).toEqual(
      expect.objectContaining({
        cache: "force-cache",
        next: expect.objectContaining({
          revalidate: 3600,
          tags: expect.arrayContaining([
            "storefront:brands",
            "storefront:home",
          ]),
        }),
      }),
    );
  });

  it("returns [] when the catalogue is empty — no invented liquor names", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(brandPage([])));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getFeaturedBrands()).resolves.toEqual([]);
  });

  it("returns [] when every row is blank or has a non-positive id", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(brandPage([emptyTitle, invalidId])));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getFeaturedBrands()).resolves.toEqual([]);
  });

  it("propagates a list 5xx instead of swapping in fallback names", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(
        { error: { code: "UNAVAILABLE", message: "offline" } },
        503,
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(getFeaturedBrands()).rejects.toMatchObject({
      status: 503,
      code: "UNAVAILABLE",
    });
  });

  it("propagates a network failure instead of swapping in fallback names", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getFeaturedBrands()).rejects.toThrow("Failed to fetch");
  });
});
