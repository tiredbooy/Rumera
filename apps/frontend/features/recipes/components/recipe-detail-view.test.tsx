import type { AnchorHTMLAttributes, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RecipeDetail } from "@/features/recipes/types";

const mocks = vi.hoisted(() => ({
  getRecipe: vi.fn(),
  listRelated: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("not-found");
  }),
}));

vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
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
vi.mock("@/components/smart-image", () => ({
  SmartImage: ({ alt }: { alt: string }) => <div role="img" aria-label={alt} />,
}));
vi.mock("@/features/motion/components/reveal", () => ({
  Reveal: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@/features/recipes/api/server", () => ({
  getRecipeBySlug: mocks.getRecipe,
  listRelatedRecipes: mocks.listRelated,
}));
vi.mock("./add-all-button", () => ({
  AddAllIngredientsButton: () => <button>افزودن همه</button>,
}));
vi.mock("./shoppable-product-card", () => ({
  ShoppableProductCard: () => <article data-product-card="true" />,
}));
vi.mock("./recipe-card", () => ({
  RecipeCard: () => <article data-related-card="true" />,
}));
vi.mock("./recipe-mobile-shop-bar", () => ({
  RecipeMobileShopBar: () => <div data-mobile-shop-bar="true" />,
}));
vi.mock("./recipe-shop-summary", () => ({
  RecipeShopSummary: () => <div data-shop-summary="true" />,
}));
vi.mock("./recipe-view-tracker", () => ({
  RecipeViewTracker: () => null,
}));

import { RecipeDetailView } from "./recipe-detail-view";

const recipe: RecipeDetail = {
  id: 3,
  title: "موخیتو",
  slug: "mojito",
  excerpt: "خلاصه",
  description: "توضیح",
  content: "<ol><li>یخ را اضافه کنید</li><li>هم بزنید</li></ol>",
  difficulty: "easy",
  prep_time_minutes: 10,
  cook_time_minutes: 0,
  total_time_minutes: 15,
  servings: 2,
  calories: 120,
  cocktail_type: "کلاسیک",
  glass_type: "هایبال",
  serving_suggestion: null,
  image_url: null,
  image_alt: null,
  status: "published",
  is_featured: false,
  published_at: "2026-07-20T10:00:00Z",
  view_count: 4,
  meta_title: null,
  meta_description: null,
  meta_keywords: null,
  canonical_url: null,
  og_image_url: null,
  user_id: 2,
  created_at: "2026-07-19T10:00:00Z",
  updated_at: "2026-07-21T10:00:00Z",
  ingredients: [
    {
      id: 1,
      product_variant_id: null,
      ingredient_name: "آب‌لیمو",
      quantity: "1.250",
      unit: "پیمانه",
      optional: false,
      notes: null,
      sort_order: 0,
    },
  ],
  products: [
    {
      recipe_product_id: 1,
      product_variant_id: 8,
      product_id: 4,
      product_title: "محصول",
      product_slug: "product",
      price: 100,
      is_available: true,
      available_stock: 3,
      sort_order: 0,
      is_primary: true,
    },
  ],
  tags: [],
  structured_data: {},
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getRecipe.mockResolvedValue(recipe);
  mocks.listRelated.mockRejectedValue(new Error("optional rail unavailable"));
});

describe("RecipeDetailView", () => {
  it("renders authored HTML, semantic metadata, localized quantities, and live JSON-LD", async () => {
    const markup = renderToStaticMarkup(
      await RecipeDetailView({ params: Promise.resolve({ slug: "mojito" }) }),
    );

    expect(markup).toContain(
      "<ol><li>یخ را اضافه کنید</li><li>هم بزنید</li></ol>",
    );
    expect(markup).toContain("۱٫۲۵ پیمانه");
    expect(markup).toContain("<dt");
    expect(markup).toContain('aria-current="page"');
    expect(markup).toContain('data-product-card="true"');
    expect(markup).not.toContain("data-related-card");
    expect(markup).toContain("دستورهای پیشنهادی موقتاً در دسترس نیستند");
    expect(markup).toContain('"@type":"HowToStep"');
    expect(markup).not.toContain('recipeInstructions":"<ol>');
  });

  it("renders a valid zero-calorie value instead of dropping it", async () => {
    mocks.getRecipe.mockResolvedValue({ ...recipe, calories: 0 });
    const markup = renderToStaticMarkup(
      await RecipeDetailView({ params: Promise.resolve({ slug: "mojito" }) }),
    );
    expect(markup).toContain("۰ کالری");
  });

  it("renders explicit empty ingredient and instruction states", async () => {
    mocks.getRecipe.mockResolvedValue({
      ...recipe,
      content: "",
      ingredients: [],
    });
    const markup = renderToStaticMarkup(
      await RecipeDetailView({ params: Promise.resolve({ slug: "mojito" }) }),
    );
    expect(markup).toContain("فهرست مواد لازم برای این دستور ثبت نشده است");
    expect(markup).toContain("مراحل تهیهٔ این دستور هنوز ثبت نشده است");
  });

  it("uses the route not-found boundary for a missing recipe", async () => {
    mocks.getRecipe.mockResolvedValue(null);
    await expect(
      RecipeDetailView({ params: Promise.resolve({ slug: "missing" }) }),
    ).rejects.toThrow("not-found");
  });
});
