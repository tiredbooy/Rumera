import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ apiFetch: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/api/client", () => ({ apiFetch: mocks.apiFetch }));

import {
  getAdminJournalCategory,
  getAdminJournalPost,
  listAdminJournalCategories,
  listAdminJournalPosts,
} from "./admin";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.apiFetch.mockResolvedValue({});
});

describe("journal admin server API", () => {
  it("uses the protected all-status article list", async () => {
    await listAdminJournalPosts({
      page: 2,
      limit: 18,
      status: "draft",
      search: "راهنما",
      sortBy: "updated_at",
      orderBy: "desc",
    });
    expect(mocks.apiFetch).toHaveBeenCalledWith(
      "/admin/blogs?page=2&limit=18&status=draft&search=%D8%B1%D8%A7%D9%87%D9%86%D9%85%D8%A7&sortBy=updated_at&orderBy=desc",
    );
  });

  it("uses numeric admin detail and category reads", async () => {
    await getAdminJournalPost(12);
    await listAdminJournalCategories();
    await getAdminJournalCategory(4);
    expect(mocks.apiFetch.mock.calls).toEqual([
      ["/admin/blogs/12"],
      ["/admin/blog-categories"],
      ["/admin/blog-categories/4"],
    ]);
  });
});
