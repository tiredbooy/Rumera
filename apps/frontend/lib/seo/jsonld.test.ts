import { afterEach, describe, expect, it } from "vitest";

import type { ProductDetail } from "@/features/catalog/products/types";
import type { JournalDetail } from "@/features/journal/types";
import type { RecipeDetail } from "@/features/recipes/types";
import { absoluteUrl, siteConfig } from "@/lib/site";

import {
  contentListLd,
  journalArticleLd,
  organizationLd,
  productDetailLd,
  recipeDetailLd,
} from "./jsonld";

const previousApi = process.env.NEXT_PUBLIC_API_URL;
const previousMedia = process.env.NEXT_PUBLIC_MEDIA_BASE_URL;

afterEach(() => {
  if (previousApi === undefined) delete process.env.NEXT_PUBLIC_API_URL;
  else process.env.NEXT_PUBLIC_API_URL = previousApi;
  if (previousMedia === undefined) delete process.env.NEXT_PUBLIC_MEDIA_BASE_URL;
  else process.env.NEXT_PUBLIC_MEDIA_BASE_URL = previousMedia;
});

/** Local split-origin media base used by structured-data image tests. */
function useLocalApiMediaOrigin() {
  process.env.NEXT_PUBLIC_API_URL = "http://localhost:8080";
  // Prefer empty media base so resolveMediaUrl falls back to API origin.
  // Avoid assigning NODE_ENV (read-only in modern @types/node); vitest is not "production".
  process.env.NEXT_PUBLIC_MEDIA_BASE_URL = "";
}

describe("productDetailLd", () => {
  it("keeps stored Toman prices unchanged and publishes IRT availability per active variant", () => {
    const product: ProductDetail = {
      id: 1,
      title: "محصول نمونه",
      slug: "sample",
      is_active: true,
      variants: [
        {
          id: 1,
          sku: "inactive-sku",
          price: 999_000,
          is_active: false,
          available_stock: 8,
        },
        {
          id: 2,
          sku: "available-sku",
          price: 250_000,
          is_active: true,
          available_stock: 3,
        },
        {
          id: 3,
          sku: "sold-out-sku",
          price: 300_000,
          is_active: true,
          available_stock: 0,
        },
        {
          id: 4,
          sku: "zero-price-sku",
          price: 0,
          is_active: true,
          available_stock: 5,
        },
      ],
    };

    const data = productDetailLd(product) as Record<string, unknown>;
    const aggregate = data.offers as {
      priceCurrency: string;
      lowPrice: number;
      highPrice: number;
      offerCount: number;
      offers: Array<Record<string, unknown>>;
    };

    expect(aggregate).toMatchObject({
      priceCurrency: "IRT",
      // Zero is a real free/zero offer once the variant is active — do not drop it.
      lowPrice: 0,
      highPrice: 300_000,
      offerCount: 3,
    });
    expect(aggregate.offers).toEqual([
      expect.objectContaining({
        price: 250_000,
        priceCurrency: "IRT",
        sku: "available-sku",
        availability: "https://schema.org/InStock",
      }),
      expect.objectContaining({
        price: 300_000,
        priceCurrency: "IRT",
        sku: "sold-out-sku",
        availability: "https://schema.org/OutOfStock",
      }),
      expect.objectContaining({
        price: 0,
        priceCurrency: "IRT",
        sku: "zero-price-sku",
        availability: "https://schema.org/InStock",
      }),
    ]);
    expect(data).not.toHaveProperty("sku");
    expect(JSON.stringify(data)).not.toContain("IRR");
    expect(JSON.stringify(data)).not.toContain("inactive-sku");
  });

  it("omits product and offer URLs when no public slug exists", () => {
    const data = productDetailLd({
      id: 1,
      title: "بدون نشانی",
      is_active: true,
      variants: [
        { id: 2, price: 125_000, is_active: true, available_stock: 1 },
      ],
    }) as Record<string, unknown>;
    const aggregate = data.offers as {
      offers: Array<Record<string, unknown>>;
    };

    expect(data).not.toHaveProperty("url");
    expect(aggregate.offers[0]).not.toHaveProperty("url");
    expect(JSON.stringify(data)).not.toContain("undefined");
  });
});

describe("editorial structured data", () => {
  it("builds absolute, backend-truthful BlogPosting data", () => {
    useLocalApiMediaOrigin();
    const post: JournalDetail = {
      id: 2,
      author_id: 8,
      title: "راهنمای سرو",
      slug: "راهنمای سرو",
      excerpt: "خلاصهٔ عمومی",
      image_url: "/media/journal/2/cover.webp",
      image_alt: "تصویر نوشته",
      og_image_url: null,
      time_to_read: 7,
      total_reads: 10,
      status: "published",
      is_featured: false,
      published_at: "2026-07-20T10:00:00Z",
      created_at: "2026-07-19T10:00:00Z",
      updated_at: "2026-07-21T10:00:00Z",
      content: "<p>متن</p>",
      meta_title: null,
      meta_description: "توضیح سئو",
      categories: [
        {
          id: 1,
          name: "راهنما",
          description: null,
          slug: "guide",
          parent_id: null,
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
      ],
      product_ids: [],
      tag_ids: [],
    };

    expect(journalArticleLd(post)).toMatchObject({
      "@type": "BlogPosting",
      description: "توضیح سئو",
      image: ["http://localhost:8080/media/journal/2/cover.webp"],
      datePublished: post.published_at,
      dateModified: post.updated_at,
      articleSection: ["راهنما"],
      timeRequired: "PT7M",
      publisher: {
        "@type": "Organization",
        name: siteConfig.name,
        url: siteConfig.url,
        logo: {
          "@type": "ImageObject",
          url: absoluteUrl(siteConfig.logo),
        },
      },
    });
    expect(journalArticleLd(post).publisher.logo.url).toBe(
      organizationLd().logo,
    );
    expect(JSON.stringify(journalArticleLd(post))).not.toContain('"author"');
    // CE-10: a dedicated social crop outranks the cover in structured data too.
    expect(
      journalArticleLd({ ...post, og_image_url: "/media/journal/2/og.webp" }),
    ).toMatchObject({ image: ["http://localhost:8080/media/journal/2/og.webp"] });
  });

  it("builds Recipe data from sanitized instructions and precise API fields", () => {
    useLocalApiMediaOrigin();
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
      image_url: "/media/recipes/3/cover.webp",
      image_alt: "موخیتو",
      status: "published",
      is_featured: true,
      published_at: "2026-07-20T10:00:00Z",
      view_count: 4,
      meta_title: null,
      meta_description: "توضیح سئو",
      meta_keywords: ["نعنا"],
      canonical_url: null,
      og_image_url: null,
      user_id: 8,
      created_at: "2026-07-19T10:00:00Z",
      updated_at: "2026-07-21T10:00:00Z",
      ingredients: [
        {
          id: 1,
          product_variant_id: null,
          ingredient_name: "نعنا",
          quantity: "1.25",
          unit: "پیمانه",
          optional: false,
          notes: null,
          sort_order: 0,
        },
      ],
      products: [],
      tags: [{ id: 2, title: "تابستانی" }],
      structured_data: { recipeInstructions: "<script>bad</script>" },
    };

    const data = recipeDetailLd(recipe) as Record<string, unknown>;
    expect(data).toMatchObject({
      "@type": "Recipe",
      url: "http://localhost:3000/recipes/mojito",
      image: ["http://localhost:8080/media/recipes/3/cover.webp"],
      datePublished: recipe.published_at,
      dateModified: recipe.updated_at,
      recipeYield: "2 نفر",
      prepTime: "PT10M",
      totalTime: "PT15M",
      recipeIngredient: ["1.25 پیمانه نعنا"],
      keywords: ["نعنا", "تابستانی"],
    });
    expect(data.recipeInstructions).toEqual([
      { "@type": "HowToStep", position: 1, text: "یخ را اضافه کنید" },
      { "@type": "HowToStep", position: 2, text: "هم بزنید" },
    ]);
    expect(JSON.stringify(data)).not.toContain("<script>");
    expect(JSON.stringify(data)).not.toContain("bad");
  });

  it("positions paginated editorial ItemLists from their real page offset", () => {
    const data = contentListLd(
      "دستورها",
      [
        { name: "یک", path: "/recipes/one" },
        { name: "دو", path: "/recipes/two" },
      ],
      13,
    );
    expect(data.itemListElement).toMatchObject([
      { position: 13, url: "http://localhost:3000/recipes/one" },
      { position: 14, url: "http://localhost:3000/recipes/two" },
    ]);
  });
});
