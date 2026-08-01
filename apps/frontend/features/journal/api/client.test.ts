import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createJournalCategory,
  createJournalPost,
  deleteJournalCategory,
  deleteJournalPost,
  JournalApiError,
  listAdminJournalPosts,
  updateJournalCategory,
  updateJournalPost,
} from "./client";

const fetchMock = vi.fn<typeof fetch>();

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});

afterEach(() => vi.unstubAllGlobals());

describe("journal admin browser API", () => {
  it("serializes list filters through the authenticated admin BFF", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ data: { results: [], pagination: {} } }),
    );
    await listAdminJournalPosts({ page: 3, status: "archived", search: "قصه" });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/admin/blogs?page=3&status=archived&search=%D9%82%D8%B5%D9%87",
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("sends exact article create and update contracts", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ data: { id: 8 } }, 201))
      .mockResolvedValueOnce(jsonResponse({ data: { id: 8 } }));
    await createJournalPost({
      title: "راهنما",
      content: "<p>متن</p>",
      status: "draft",
      category_ids: [2],
    });
    await updateJournalPost(8, {
      status: "published",
      excerpt: null,
      product_ids: [],
    });
    expect(fetchMock.mock.calls[0]).toEqual([
      "/api/admin/admin/blogs",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          title: "راهنما",
          content: "<p>متن</p>",
          status: "draft",
          category_ids: [2],
        }),
      }),
    ]);
    expect(fetchMock.mock.calls[1]).toEqual([
      "/api/admin/admin/blogs/8",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          status: "published",
          excerpt: null,
          product_ids: [],
        }),
      }),
    ]);
  });

  it("supports category create/update clearing and both delete flows", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ data: { id: 3 } }, 201))
      .mockResolvedValueOnce(jsonResponse({ data: { id: 3 } }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    await createJournalCategory({ name: "راهنما", parent_id: null });
    await updateJournalCategory(3, {
      name: "راهنمای خرید",
      description: null,
      slug: null,
      parent_id: null,
    });
    await deleteJournalPost(9);
    await deleteJournalCategory(3);
    expect(fetchMock.mock.calls.map(([path, init]) => [path, init?.method])).toEqual([
      ["/api/admin/admin/blog-categories", "POST"],
      ["/api/admin/admin/blog-categories/3", "PATCH"],
      ["/api/admin/admin/blogs/9", "DELETE"],
      ["/api/admin/admin/blog-categories/3", "DELETE"],
    ]);
  });

  it("preserves field-level backend errors", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "validation failed",
            fields: { slug: ["slug is already used"] },
          },
        },
        422,
      ),
    );
    const error = await updateJournalPost(8, { slug: "duplicate" }).catch(
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(JournalApiError);
    expect((error as JournalApiError).fields).toEqual({
      slug: ["slug is already used"],
    });
  });
});
