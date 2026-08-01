import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RecipeDetail } from "@/features/recipes/types";

const mocks = vi.hoisted(() => ({
  getRecipe: vi.fn(),
  listSlugs: vi.fn(),
  view: vi.fn(() => null),
}));

vi.mock("@/features/recipes/api/server", () => ({
  getRecipeBySlug: mocks.getRecipe,
  listRecipeSlugs: mocks.listSlugs,
}));
vi.mock("@/features/recipes/components/recipe-detail-view", () => ({
  RecipeDetailView: mocks.view,
}));

import { generateMetadata, generateStaticParams } from "./page";

const recipe: RecipeDetail = {
  id: 3,
  title: "موخیتو",
  slug: "mojito",
  excerpt: "خلاصه",
  description: "توضیح",
  content: "<ol><li>هم بزنید</li></ol>",
  difficulty: "easy",
  prep_time_minutes: 10,
  cook_time_minutes: 0,
  total_time_minutes: 10,
  servings: 2,
  calories: null,
  cocktail_type: "کلاسیک",
  glass_type: null,
  serving_suggestion: null,
  image_url: "/media/recipes/3/cover.webp",
  image_alt: "موخیتو",
  status: "published",
  is_featured: false,
  published_at: "2026-07-20T10:00:00Z",
  view_count: 3,
  meta_title: "  عنوان سئو  ",
  meta_description: "  توضیح سئو  ",
  meta_keywords: ["نعنا"],
  canonical_url: "https://example.com/recipes/mojito",
  og_image_url: null,
  user_id: 2,
  created_at: "2026-07-19T10:00:00Z",
  updated_at: "2026-07-21T10:00:00Z",
  ingredients: [],
  products: [],
  tags: [{ id: 4, title: "تابستانی" }],
  structured_data: {},
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getRecipe.mockResolvedValue(recipe);
  mocks.listSlugs.mockResolvedValue(["one", "two"]);
});

describe("recipe detail route", () => {
  it("uses validated backend SEO fields, canonical URL, keywords, and dates", async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: recipe.slug }),
    });
    expect(metadata.title).toBe("عنوان سئو");
    expect(metadata.description).toBe("توضیح سئو");
    expect(metadata.alternates?.canonical).toBe(recipe.canonical_url);
    expect(metadata.keywords).toEqual(["نعنا", "تابستانی"]);
    expect(metadata.openGraph).toMatchObject({
      type: "article",
      publishedTime: recipe.published_at,
      modifiedTime: recipe.updated_at,
      section: recipe.cocktail_type,
    });
  });

  it("keeps a missing recipe noindexed at the requested encoded path", async () => {
    mocks.getRecipe.mockResolvedValue(null);
    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: "گم شده / ?" }),
    });
    expect(metadata.robots).toMatchObject({ index: false, follow: false });
    expect(metadata.alternates?.canonical).toBe(
      `http://localhost:3000/recipes/${encodeURIComponent("گم شده / ?")}`,
    );
  });

  it("discovers every sitemap slug", async () => {
    await expect(generateStaticParams()).resolves.toEqual([
      { slug: "one" },
      { slug: "two" },
    ]);
  });
});
