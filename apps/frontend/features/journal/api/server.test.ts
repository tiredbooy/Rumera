import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  listAllJournalPosts,
  listJournalPage,
  listJournalSlugs,
} from "./server";
import { JOURNAL_CACHE_TAG } from "@/lib/cache-tags";

const post = {
  id: 1,
  author_id: 2,
  title: "نوشته",
  slug: "post",
  excerpt: null,
  image_url: null,
  image_alt: null,
  time_to_read: 4,
  total_reads: 2,
  status: "published",
  is_featured: false,
  published_at: "2026-07-20T10:00:00Z",
  created_at: "2026-07-19T10:00:00Z",
  updated_at: "2026-07-20T10:00:00Z",
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

afterEach(() => vi.unstubAllGlobals());

describe("journal public API", () => {
  it("serializes the complete supported public list query", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ results: [post], pagination: pagination(2, 3) }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    await listJournalPage({
      page: 2,
      limit: 24,
      search: "مالت",
      category_id: 4,
      exclude_id: 9,
      sortBy: "total_reads",
      orderBy: "desc",
    });
    const url = String(fetchMock.mock.calls[0]?.[0]);
    for (const value of [
      "page=2",
      "limit=24",
      `search=${encodeURIComponent("مالت")}`,
      "category_id=4",
      "exclude_id=9",
      "sortBy=total_reads",
      "orderBy=desc",
    ]) {
      expect(url).toContain(value);
    }
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      next: { revalidate: 3600, tags: [JOURNAL_CACHE_TAG] },
    });
  });

  it("discovers journal slugs beyond the first 100-item page", async () => {
    const fetchMock = vi.fn((input: string | URL | Request) => {
      const secondPage = String(input).includes("page=2");
      return Promise.resolve(
        new Response(
          JSON.stringify({
            results: [secondPage ? { ...post, id: 2, slug: "second" } : post],
            pagination: pagination(secondPage ? 2 : 1, 2),
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(listJournalSlugs()).resolves.toEqual(["post", "second"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns every journal item for sitemap metadata", async () => {
    const fetchMock = vi.fn((input: string | URL | Request) => {
      const secondPage = String(input).includes("page=2");
      return Promise.resolve(
        new Response(
          JSON.stringify({
            results: [secondPage ? { ...post, id: 2, slug: "second" } : post],
            pagination: pagination(secondPage ? 2 : 1, 2),
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(listAllJournalPosts()).resolves.toMatchObject([
      { id: 1, slug: "post" },
      { id: 2, slug: "second" },
    ]);
  });
});
