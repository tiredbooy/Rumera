import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  allCategorySlugs: vi.fn(),
  getCategoryBySlug: vi.fn(),
  categoryDetailView: vi.fn(() => null),
}));

vi.mock("@/features/catalog/categories/api", () => ({
  allCategorySlugs: mocks.allCategorySlugs,
  getCategoryBySlug: mocks.getCategoryBySlug,
}));
vi.mock(
  "@/features/catalog/categories/components/category-detail-view",
  () => ({ CategoryDetailView: mocks.categoryDetailView }),
);

import CategoryPage, { generateMetadata, generateStaticParams } from "./page";

const category = {
  id: 7,
  title: "ویسکی",
  description: "مجموعهٔ ویسکی‌های منتخب",
  slug: "ویسکی-ویژه",
  image_url: "/images/categories/whisky.jpg",
  is_featured: false,
  display_order: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.allCategorySlugs.mockResolvedValue(["whisky", "wine"]);
  mocks.getCategoryBySlug.mockResolvedValue(category);
});

describe("category detail route", () => {
  it("generates every slug returned by the paginated category helper", async () => {
    await expect(generateStaticParams()).resolves.toEqual([
      { category: "whisky" },
      { category: "wine" },
    ]);
  });

  it("forwards the promised Next 16 params and searchParams unchanged", () => {
    const params = Promise.resolve({ category: "whisky" });
    const searchParams = Promise.resolve({
      page: ["2", "3"],
      q: "مالت",
      sort: "alphabetical",
    });

    const element = CategoryPage({ params, searchParams });
    expect(element.props).toMatchObject({ params, searchParams });
  });

  it("keeps a missing category at the encoded requested canonical and noindexes it", async () => {
    mocks.getCategoryBySlug.mockResolvedValue(null);

    const metadata = await generateMetadata({
      params: Promise.resolve({ category: "ویژه / A?" }),
      searchParams: Promise.resolve({ q: "ignored" }),
    });

    expect(metadata.robots).toMatchObject({ index: false, follow: false });
    expect(metadata.alternates?.canonical).toBe(
      `http://localhost:3000/categories/${encodeURIComponent("ویژه / A?")}`,
    );
  });

  it("uses the canonical category slug, description, and category image", async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ category: category.slug }),
      searchParams: Promise.resolve({}),
    });

    expect(metadata.title).toBe(category.title);
    expect(metadata.description).toBe(category.description);
    expect(metadata.alternates?.canonical).toBe(
      `http://localhost:3000/categories/${encodeURIComponent(category.slug)}`,
    );
    expect(metadata.openGraph).toMatchObject({
      images: [category.image_url],
    });
    expect(metadata.robots).toBeUndefined();
  });

  it("uses the default social image when the category has no image", async () => {
    mocks.getCategoryBySlug.mockResolvedValue({
      ...category,
      image_url: undefined,
    });

    const metadata = await generateMetadata({
      params: Promise.resolve({ category: category.slug }),
      searchParams: Promise.resolve({}),
    });

    expect(metadata.openGraph).toMatchObject({ images: ["/opengraph-image"] });
    expect(JSON.stringify(metadata)).not.toContain("undefined");
  });

  it("self-canonicalizes and titles an unfiltered paginated page", async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ category: category.slug }),
      searchParams: Promise.resolve({ page: "2" }),
    });

    expect(String(metadata.title)).toContain("صفحهٔ ۲");
    expect(metadata.alternates?.canonical).toBe(
      `http://localhost:3000/categories/${encodeURIComponent(category.slug)}?page=2`,
    );
    expect(metadata.robots).toBeUndefined();
  });

  it("noindexes search and sort variants with the clean category canonical", async () => {
    for (const searchParams of [
      { q: "مالت", page: "2" },
      { sort: "recently-updated", page: "3" },
      { sort: ["alphabetical", "newest"] },
    ]) {
      const metadata = await generateMetadata({
        params: Promise.resolve({ category: category.slug }),
        searchParams: Promise.resolve(searchParams),
      });

      expect(metadata.robots).toMatchObject({ index: false, follow: false });
      expect(metadata.alternates?.canonical).toBe(
        `http://localhost:3000/categories/${encodeURIComponent(category.slug)}`,
      );
    }
  });
});
