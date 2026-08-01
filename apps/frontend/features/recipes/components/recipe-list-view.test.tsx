import type { AnchorHTMLAttributes, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RecipeListItem } from "@/features/recipes/types";
import type { Pagination } from "@/lib/api/types";

const mocks = vi.hoisted(() => ({
  listFeatured: vi.fn(),
  listRecipes: vi.fn(),
  redirect: vi.fn((href: string) => {
    throw new Error(`redirect:${href}`);
  }),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
    children: ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("@/features/motion/components/reveal", () => ({
  Reveal: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@/components/smart-image", () => ({
  SmartImage: ({ alt }: { alt: string }) => <div role="img" aria-label={alt} />,
}));
vi.mock("@/features/recipes/api/server", () => ({
  listFeaturedRecipes: mocks.listFeatured,
  listRecipes: mocks.listRecipes,
}));
vi.mock("./recipe-filters", () => ({
  RecipeFilters: () => <div data-recipe-filters />,
}));
vi.mock("./recipe-card", () => ({
  RecipeCard: ({ recipe }: { recipe: RecipeListItem }) => (
    <article data-card={recipe.id}>{recipe.title}</article>
  ),
}));

import { RecipeListView } from "./recipe-list-view";

function recipe(
  id: number,
  overrides: Partial<RecipeListItem> = {},
): RecipeListItem {
  return {
    id,
    title: `دستور ${id}`,
    slug: `recipe-${id}`,
    excerpt: null,
    difficulty: "easy",
    total_time_minutes: 15,
    servings: 2,
    image_url: null,
    image_alt: null,
    cocktail_type: null,
    is_featured: false,
    view_count: 0,
    published_at: "2026-07-20T10:00:00Z",
    ...overrides,
  };
}

function pagination(page = 1, totalItems = 2, totalPages = 1): Pagination {
  return {
    page,
    limit: 12,
    total_items: totalItems,
    total_pages: totalPages,
    has_next: page < totalPages,
    has_prev: page > 1,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listFeatured.mockResolvedValue([]);
  mocks.listRecipes.mockResolvedValue({
    results: [recipe(1), recipe(2)],
    pagination: pagination(),
  });
});

describe("RecipeListView", () => {
  it("deduplicates a featured spotlight from the first result page", async () => {
    const spotlight = recipe(1, { is_featured: true, title: "منتخب" });
    mocks.listFeatured.mockResolvedValue([spotlight]);
    mocks.listRecipes.mockResolvedValue({
      results: [recipe(2)],
      pagination: pagination(1, 1, 1),
    });

    const markup = renderToStaticMarkup(
      await RecipeListView({ searchParams: Promise.resolve({}) }),
    );
    expect(markup.match(/منتخب/g)?.length).toBeGreaterThan(0);
    expect(markup).toContain('data-card="2"');
    expect(markup).not.toContain('data-card="1"');
    expect(mocks.listRecipes).toHaveBeenCalledWith(
      expect.objectContaining({ exclude_id: 1 }),
    );
    expect(markup).toContain("۲ دستور");
  });

  it("sends only parsed URL state to the backend", async () => {
    mocks.listRecipes.mockResolvedValue({
      results: [recipe(13)],
      pagination: pagination(2, 13, 2),
    });
    await RecipeListView({
      searchParams: Promise.resolve({
        q: "موخیتو",
        difficulty: "medium",
        sort: "quick",
        page: "2",
      }),
    });
    expect(mocks.listRecipes).toHaveBeenCalledWith({
      page: 2,
      limit: 12,
      search: "موخیتو",
      difficulty: "medium",
      sortBy: "total_time",
      orderBy: "asc",
    });
    expect(mocks.listFeatured).not.toHaveBeenCalled();
  });

  it("redirects malformed and beyond-final pages", async () => {
    await expect(
      RecipeListView({
        searchParams: Promise.resolve({ difficulty: ["easy", "hard"] }),
      }),
    ).rejects.toThrow("redirect:/recipes");
    expect(mocks.listRecipes).not.toHaveBeenCalled();

    mocks.listRecipes.mockResolvedValue({
      results: [],
      pagination: pagination(9, 30, 3),
    });
    await expect(
      RecipeListView({ searchParams: Promise.resolve({ page: "9" }) }),
    ).rejects.toThrow("redirect:/recipes?page=3");
  });

  it("distinguishes a filtered no-match state from an empty catalogue", async () => {
    mocks.listRecipes.mockResolvedValue({
      results: [],
      pagination: pagination(1, 0, 1),
    });
    const filtered = renderToStaticMarkup(
      await RecipeListView({
        searchParams: Promise.resolve({ difficulty: "hard" }),
      }),
    );
    expect(filtered).toContain("دستوری پیدا نشد");
    expect(filtered).toContain('href="/recipes"');

    const empty = renderToStaticMarkup(
      await RecipeListView({ searchParams: Promise.resolve({}) }),
    );
    expect(empty).toContain("به‌زودی");
  });
});
