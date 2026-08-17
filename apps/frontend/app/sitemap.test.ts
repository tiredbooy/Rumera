import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listAllTags: vi.fn(),
  allProductSlugs: vi.fn(),
  listCategories: vi.fn(),
  listAllJournalPosts: vi.fn(),
  listRecipeSitemapItems: vi.fn(),
}));

vi.mock("@/features/catalog/products/api/public", () => ({
  allProductSlugs: mocks.allProductSlugs,
}));
vi.mock("@/features/catalog/categories/api", () => ({
  listCategories: mocks.listCategories,
}));
vi.mock("@/features/catalog/tags/api/public", () => ({
  listAllTags: mocks.listAllTags,
}));
vi.mock("@/features/recipes/api/server", () => ({
  listRecipeSitemapItems: mocks.listRecipeSitemapItems,
}));
vi.mock("@/features/journal/api/server", () => ({
  listAllJournalPosts: mocks.listAllJournalPosts,
}));

import { absoluteUrl } from "@/lib/site";
import sitemap from "./sitemap";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.allProductSlugs.mockResolvedValue([]);
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
  mocks.listRecipeSitemapItems.mockResolvedValue([]);
  mocks.listAllJournalPosts.mockResolvedValue([]);
});

describe("sitemap product discovery", () => {
  it("uses every validated slug and encodes product URLs", async () => {
    mocks.allProductSlugs.mockResolvedValue(["first", "ویژه / A?"]);

    const entries = await sitemap();

    expect(entries).toContainEqual(
      expect.objectContaining({ url: absoluteUrl("/products/first") }),
    );
    expect(entries).toContainEqual(
      expect.objectContaining({
        url: absoluteUrl(`/products/${encodeURIComponent("ویژه / A?")}`),
      }),
    );
    expect(entries.some((entry) => entry.url.includes("undefined"))).toBe(false);
    expect(mocks.allProductSlugs).toHaveBeenCalledTimes(1);
  });
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

describe("sitemap brands discovery", () => {
  it("includes the public brands index", async () => {
    const entries = await sitemap();

    expect(entries).toContainEqual(
      expect.objectContaining({
        url: absoluteUrl("/brands"),
        changeFrequency: "weekly",
        priority: 0.7,
      }),
    );
  });
});

describe("sitemap category discovery", () => {
  it("includes the category directory and only encoded routeable details", async () => {
    mocks.listCategories.mockResolvedValue([
      {
        id: 1,
        title: "گروه ساختاری",
        is_featured: false,
        display_order: 0,
      },
      {
        id: 2,
        title: "انتخاب ویژه",
        slug: "ویژه / A?",
        is_featured: false,
        display_order: 1,
      },
    ]);

    const entries = await sitemap();

    expect(entries).toContainEqual(
      expect.objectContaining({
        url: absoluteUrl("/categories"),
        changeFrequency: "weekly",
      }),
    );
    expect(entries).toContainEqual(
      expect.objectContaining({
        url: absoluteUrl(`/categories/${encodeURIComponent("ویژه / A?")}`),
      }),
    );
    expect(entries.some((entry) => entry.url.includes("undefined"))).toBe(
      false,
    );
    expect(mocks.listCategories).toHaveBeenCalledTimes(1);
  });
});

describe("sitemap editorial discovery", () => {
  it("uses every encoded recipe and journal slug with edit timestamps", async () => {
    mocks.listRecipeSitemapItems.mockResolvedValue([
      {
        slug: "نوشیدنی / ویژه",
        updated_at: "2026-07-22T00:00:00Z",
      },
    ]);
    mocks.listAllJournalPosts.mockResolvedValue([
      {
        slug: "راهنما / ویژه",
        updated_at: "2026-07-23T00:00:00Z",
      },
    ]);

    const entries = await sitemap();
    expect(entries).toContainEqual(
      expect.objectContaining({
        url: absoluteUrl(
          `/recipes/${encodeURIComponent("نوشیدنی / ویژه")}`,
        ),
        lastModified: new Date("2026-07-22T00:00:00Z"),
      }),
    );
    expect(entries).toContainEqual(
      expect.objectContaining({
        url: absoluteUrl(
          `/journal/${encodeURIComponent("راهنما / ویژه")}`,
        ),
        lastModified: new Date("2026-07-23T00:00:00Z"),
      }),
    );
  });
});
