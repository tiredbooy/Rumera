import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createTag,
  deleteTag,
  listAdminTags,
  listAllTags,
  syncProductTags,
  updateTag,
} from "./api";

afterEach(() => {
  vi.unstubAllGlobals();
});

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

describe("tag admin API", () => {
  it("reads the top-level paginated list with exact query keys", async () => {
    const payload = { results: [], pagination: pagination(2, 2) };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      listAdminTags({
        page: 2,
        limit: 20,
        search: "gift set",
        sortBy: "updated_at",
        orderBy: "desc",
      }),
    ).resolves.toEqual(payload);
    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).toContain("/api/admin/tags?");
    expect(url).toContain("search=gift+set");
    expect(url).toContain("sortBy=updated_at");
    expect(url).toContain("orderBy=desc");
  });

  it("writes slug and nullable description and accepts a bodyless delete", async () => {
    const tag = {
      id: 7,
      title: "هدیه",
      slug: "gift",
      created_at: "2026-07-19T00:00:00Z",
      updated_at: "2026-07-19T00:00:00Z",
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: tag }), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: tag }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await createTag({ title: "هدیه", slug: "gift", description: null });
    await updateTag(7, { slug: "special-gift", description: null });
    await deleteTag(7);
    await syncProductTags(12, { tag_ids: [7, 9] });

    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/admin/admin/tags");
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      title: "هدیه",
      slug: "gift",
      description: null,
    });
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/admin/admin/tags/7");
    expect(fetchMock.mock.calls[2]?.[1]).toEqual(
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(fetchMock.mock.calls[3]?.[0]).toBe(
      "/api/admin/admin/products/12/tags",
    );
    expect(fetchMock.mock.calls[3]?.[1]).toEqual(
      expect.objectContaining({ method: "PUT", body: '{"tag_ids":[7,9]}' }),
    );
  });

  it("loads every selector page without per-tag requests", async () => {
    const fetchMock = vi.fn((input: string | URL | Request) => {
      const url = String(input);
      const second = url.includes("page=2");
      const tag = {
        id: second ? 2 : 1,
        title: second ? "دو" : "یک",
        slug: second ? "two" : "one",
        created_at: "2026-07-19T00:00:00Z",
        updated_at: "2026-07-19T00:00:00Z",
      };
      return Promise.resolve(
        new Response(
          JSON.stringify({
            results: [tag],
            pagination: pagination(second ? 2 : 1, 2),
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(listAllTags()).resolves.toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(
      fetchMock.mock.calls.every(([url]) => String(url).includes("/tags?")),
    ).toBe(true);
  });

  it("treats a missing pagination envelope as a single page", async () => {
    const tag = {
      id: 3,
      title: "هدیه",
      slug: "gift",
      created_at: "2026-08-16T00:00:00Z",
      updated_at: "2026-08-16T00:00:00Z",
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ results: [tag] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(listAllTags()).resolves.toEqual([tag]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
