import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/api/client", () => ({ apiFetch: vi.fn() }));

import { getRecipeBySlug, listRecipes } from "./server";

afterEach(() => vi.unstubAllGlobals());

describe("recipe public API", () => {
  it("serializes the parsed storefront query without renaming backend fields", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [],
          pagination: {
            page: 3,
            limit: 12,
            total_items: 0,
            total_pages: 1,
            has_next: false,
            has_prev: true,
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await listRecipes({
      page: 3,
      limit: 12,
      search: "موخیتو",
      difficulty: "medium",
      exclude_id: 9,
      sortBy: "total_time",
      orderBy: "asc",
    });
    const url = String(fetchMock.mock.calls[0]?.[0]);
    for (const value of [
      "page=3",
      "limit=12",
      `search=${encodeURIComponent("موخیتو")}`,
      "difficulty=medium",
      "exclude_id=9",
      "sortBy=total_time",
      "orderBy=asc",
    ]) {
      expect(url).toContain(value);
    }
  });

  it("bounds live detail freshness without forcing a dynamic SSG fetch", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 1, slug: "mojito" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await getRecipeBySlug("mojito");
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      cache: "force-cache",
      next: { revalidate: 120 },
    });
  });
});
