import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { organizationLd, websiteLd } from "@/lib/seo/jsonld";

const mocks = vi.hoisted(() => ({
  listActiveHeroSlides: vi.fn(),
  getTrending: vi.fn(),
  getFeaturedCategories: vi.fn(),
  getFeaturedBrands: vi.fn(),
  listProducts: vi.fn(),
}));

vi.mock("@/features/hero-slides/api/server", () => ({
  listActiveHeroSlides: mocks.listActiveHeroSlides,
}));
vi.mock("@/features/recommendations/api", () => ({
  getTrending: mocks.getTrending,
}));
vi.mock("@/features/catalog/categories/api", () => ({
  getFeaturedCategories: mocks.getFeaturedCategories,
}));
vi.mock("@/features/catalog/brands/api", () => ({
  getFeaturedBrands: mocks.getFeaturedBrands,
}));
vi.mock("@/features/catalog/products/api/public", () => ({
  listProducts: mocks.listProducts,
}));
vi.mock("@/features/catalog/brands/components/brand-marquee", () => ({
  BrandMarquee: () => null,
}));
vi.mock("@/features/catalog/products/components/recommendation-rail", () => ({
  RecommendationRail: () => null,
}));
vi.mock("./CatalogSection", () => ({
  CatalogSection: () => null,
}));
vi.mock("./CategoryGrid", () => ({
  CategoryGrid: () => null,
}));
vi.mock("./for-you-rail", () => ({
  ForYouRail: () => null,
}));
vi.mock("./hero-carousel", () => ({
  HeroCarousel: () => null,
}));
vi.mock("./PerksSection", () => ({
  PerksSection: () => null,
}));
vi.mock("./StorySection", () => ({
  StorySection: () => null,
}));
vi.mock("./TestimonialSection", () => ({
  TestimonialSection: () => null,
}));

import { HomeView } from "./home-view";

function scriptBodies(markup: string): unknown[] {
  return Array.from(
    markup.matchAll(
      /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g,
    ),
    (match) => JSON.parse(match[1]) as unknown,
  );
}

const emptyCatalogue = {
  results: [],
  pagination: {
    page: 1,
    limit: 8,
    total_items: 0,
    total_pages: 0,
    has_next: false,
    has_prev: false,
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listActiveHeroSlides.mockResolvedValue([]);
  mocks.getTrending.mockResolvedValue([]);
  mocks.getFeaturedCategories.mockResolvedValue([]);
  mocks.getFeaturedBrands.mockResolvedValue([]);
  mocks.listProducts.mockResolvedValue(emptyCatalogue);
});

describe("HomeView JSON-LD", () => {
  it("emits live Organization and WebSite graphs from siteConfig", async () => {
    const markup = renderToStaticMarkup(await HomeView());
    const payloads = scriptBodies(markup);

    expect(payloads).toEqual([organizationLd(), websiteLd()]);
    expect(markup).toContain("فروشگاه رومرا");
  });

  it("does not emit a mock product ItemList", async () => {
    const markup = renderToStaticMarkup(await HomeView());
    const payloads = scriptBodies(markup) as Array<Record<string, unknown>>;

    expect(payloads.map((payload) => payload["@type"])).toEqual([
      "Organization",
      "WebSite",
    ]);
    expect(markup).not.toContain("بطری‌های منتخب");
    expect(JSON.stringify(payloads)).not.toContain('"@type":"ItemList"');
    expect(JSON.stringify(payloads)).not.toContain('"@type":"Product"');
  });
});
