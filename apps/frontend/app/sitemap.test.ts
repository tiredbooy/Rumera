import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listAllTags: vi.fn(),
  listCategories: vi.fn(),
  listJournalPosts: vi.fn(),
  listProducts: vi.fn(),
  listRecipeSlugs: vi.fn(),
}));

vi.mock("@/features/catalog/products/api/public", () => ({
  listProducts: mocks.listProducts,
}));
vi.mock("@/features/catalog/categories/api", () => ({
  listCategories: mocks.listCategories,
}));
vi.mock("@/features/catalog/tags/api/public", () => ({
  listAllTags: mocks.listAllTags,
}));
vi.mock("@/features/recipes/api/server", () => ({
  listRecipeSlugs: mocks.listRecipeSlugs,
}));
vi.mock("@/features/journal/api/server", () => ({
  listJournalPosts: mocks.listJournalPosts,
}));

import { absoluteUrl } from "@/lib/site";
import sitemap from "./sitemap";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listProducts.mockResolvedValue({ results: [] });
  mocks.listCategories.mockResolvedValue([]);
  mocks.listAllTags.mockResolvedValue([
    {
      id: 7,
      title: "هدیه",
      slug: "gift",
      created_at: "2026-07-18T00:00:00Z",
      updated_at: "2026-07-19T00:00:00Z",
    },
  ]);
  mocks.listRecipeSlugs.mockResolvedValue([]);
  mocks.listJournalPosts.mockResolvedValue([]);
});

describe("sitemap tag discovery", () => {
  it("includes the tag directory and numeric tag details", async () => {
    const entries = await sitemap();

    expect(entries).toContainEqual(
      expect.objectContaining({
        url: absoluteUrl("/tags"),
        changeFrequency: "weekly",
      }),
    );
    expect(entries).toContainEqual({
      url: absoluteUrl("/tags/7"),
      lastModified: new Date("2026-07-19T00:00:00Z"),
      changeFrequency: "weekly",
      priority: 0.6,
    });
    expect(mocks.listAllTags).toHaveBeenCalledTimes(1);
  });
});
