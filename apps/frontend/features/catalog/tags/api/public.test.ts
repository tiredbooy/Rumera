import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getProductTags, getTag, listAllTags, listTags } from "./public";

const tag = {
  id: 7,
  title: "هدیه",
  slug: "gift",
  description: "برای هدیه",
  created_at: "2026-07-18T00:00:00Z",
  updated_at: "2026-07-19T00:00:00Z",
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

describe("public tag API", () => {
  it("reads the top-level paginated contract with exact query keys", async () => {
    const payload = { results: [tag], pagination: pagination(2, 2) };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      listTags({
        page: 2,
        limit: 20,
        search: "gift set",
        sortBy: "updated_at",
        orderBy: "desc",
      }),
    ).resolves.toEqual(payload);

    const [url, options] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toContain(
      "/api/v1/tags?page=2&limit=20&search=gift+set&sortBy=updated_at&orderBy=desc",
    );
    expect(options).toEqual(expect.objectContaining({ cache: "no-store" }));
  });

  it("maps only a typed 404 to a missing tag", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: { code: "NOT_FOUND", message: "missing" },
          }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: { code: "UNAVAILABLE", message: "offline" },
          }),
          {
            status: 503,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(getTag(7)).resolves.toBeNull();
    await expect(getTag(7)).rejects.toMatchObject({
      status: 503,
      code: "UNAVAILABLE",
    });
  });

  it("loads every tag page exactly once", async () => {
    const secondTag = { ...tag, id: 8, title: "تابستان", slug: "summer" };
    const fetchMock = vi.fn((input: string | URL | Request) => {
      const secondPage = String(input).includes("page=2");
      return Promise.resolve(
        new Response(
          JSON.stringify({
            results: [secondPage ? secondTag : tag],
            pagination: pagination(secondPage ? 2 : 1, 2),
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(listAllTags()).resolves.toEqual([tag, secondTag]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      "page=1&limit=100&sortBy=title&orderBy=asc",
    );
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("page=2");
  });

  it("unwraps the reduced product-tag projection", async () => {
    const payload = [{ id: tag.id, title: tag.title }];
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: payload }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(getProductTags(12)).resolves.toEqual(payload);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      "/api/v1/products/12/tags",
    );
  });
});
