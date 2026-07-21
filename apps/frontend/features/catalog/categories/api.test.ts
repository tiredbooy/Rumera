import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { allCategorySlugs, getCategoryBySlug, listCategories } from "./api";

const category = {
  id: 7,
  title: "ویسکی",
  slug: "whisky",
  is_featured: false,
  display_order: 0,
};

function pagination(page: number, totalPages = 1) {
  return {
    page,
    limit: 100,
    total_items: totalPages,
    total_pages: totalPages,
    has_next: page < totalPages,
    has_prev: page > 1,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("public category API", () => {
  it("uses the encoded exact-slug endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: category }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(getCategoryBySlug("ویژه-A")).resolves.toEqual(category);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      `/api/v1/categories/slug/${encodeURIComponent("ویژه-A")}`,
    );
  });

  it("maps only a typed 404 to a missing category", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ error: { code: "NOT_FOUND", message: "missing" } }),
          { status: 404, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: { code: "UNAVAILABLE", message: "offline" },
          }),
          { status: 503, headers: { "Content-Type": "application/json" } },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(getCategoryBySlug("missing")).resolves.toBeNull();
    await expect(getCategoryBySlug("broken")).rejects.toMatchObject({
      status: 503,
      code: "UNAVAILABLE",
    });
  });

  it("loads category slugs beyond the first 100-item page", async () => {
    const secondCategory = {
      ...category,
      id: 8,
      title: "شراب",
      slug: " wine ",
    };
    const fetchMock = vi.fn((input: string | URL | Request) => {
      const secondPage = String(input).includes("page=2");
      return Promise.resolve(
        new Response(
          JSON.stringify({
            results: [secondPage ? secondCategory : category],
            pagination: pagination(secondPage ? 2 : 1, 2),
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(listCategories()).resolves.toEqual([category, secondCategory]);
    await expect(allCategorySlugs()).resolves.toEqual(["whisky", "wine"]);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("page=1&limit=100");
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("page=2&limit=100");
  });
});
