import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { allProductSlugs, getProductBySlug } from "./public";

const product = {
  id: 7,
  title: "محصول نمونه",
  slug: "sample",
  is_active: true,
  variants: [],
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

describe("public product API", () => {
  it("uses the encoded exact-slug endpoint without retaining detail responses", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: product }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(getProductBySlug("ویژه / A?")).resolves.toEqual(product);

    const [url, options] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toContain(
      `/api/v1/products/slug/${encodeURIComponent("ویژه / A?")}`,
    );
    expect(options).toEqual(expect.objectContaining({ cache: "no-store" }));
  });

  it("maps only a typed 404 to a missing product", async () => {
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

    await expect(getProductBySlug("missing")).resolves.toBeNull();
    await expect(getProductBySlug("broken")).rejects.toMatchObject({
      status: 503,
      code: "UNAVAILABLE",
    });
  });

  it("loads product slugs beyond the first 100-item page", async () => {
    const fetchMock = vi.fn((input: string | URL | Request) => {
      const secondPage = String(input).includes("page=2");
      return Promise.resolve(
        new Response(
          JSON.stringify({
            results: [
              secondPage ? { ...product, id: 8, slug: "second-page" } : product,
            ],
            pagination: pagination(secondPage ? 2 : 1, 2),
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(allProductSlugs()).resolves.toEqual(["sample", "second-page"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("page=1&limit=100");
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("page=2&limit=100");
  });
});
