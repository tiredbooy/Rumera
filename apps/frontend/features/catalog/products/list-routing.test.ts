import { describe, expect, it } from "vitest";

import {
  parseProductListRouteQuery,
  productListHref,
  productListRedirectHref,
  PRODUCT_LIST_SORT_OPTIONS,
} from "./list-routing";

const CAMPAIGN_PARAMS = {
  utm_source: "google",
  utm_medium: "cpc",
  utm_campaign: "spring-whisky",
  utm_content: "hero-a",
  utm_term: "ویسکی ژاپنی",
  gclid: "EAIaIQobChMI",
  fbclid: "IwAR0abc",
} as const;

describe("product list routing", () => {
  it("defaults to newest and maps only supported sort fields", () => {
    expect(parseProductListRouteQuery({})).toMatchObject({
      page: 1,
      sortBy: "created_at",
      orderBy: "desc",
      sortMode: "newest",
      needsRedirect: false,
    });

    expect(
      parseProductListRouteQuery({ sortBy: "price", orderBy: "asc" }),
    ).toMatchObject({
      sortBy: "price",
      orderBy: "asc",
      sortMode: "price-asc",
      needsRedirect: false,
    });

    expect(
      parseProductListRouteQuery({ sortBy: "price", orderBy: "desc" }),
    ).toMatchObject({
      sortMode: "price-desc",
    });

    expect(
      parseProductListRouteQuery({ sortBy: "title", orderBy: "asc" }),
    ).toMatchObject({
      sortMode: "alphabetical",
    });
  });

  it("lets campaign params through without a redirect", () => {
    const query = parseProductListRouteQuery({ ...CAMPAIGN_PARAMS });

    expect(query).toMatchObject({
      page: 1,
      search: undefined,
      brand: undefined,
      sortBy: "created_at",
      orderBy: "desc",
      needsRedirect: false,
    });
    expect(Object.fromEntries(query.passthrough)).toEqual(CAMPAIGN_PARAMS);
    // Nothing to correct, so no redirect href is ever built for this URL.
    expect(productListRedirectHref(query, query.page)).toBe(
      `/products?${new URLSearchParams(CAMPAIGN_PARAMS).toString()}`,
    );
  });

  it("keeps campaign params across a catalogue-triggered redirect", () => {
    // `page=1` and an uppercase brand are the legitimate normalisations.
    const query = parseProductListRouteQuery({
      ...CAMPAIGN_PARAMS,
      page: "1",
      brand: " Jack-Daniel ",
      sortBy: "price",
      orderBy: "asc",
    });

    expect(query).toMatchObject({
      page: 1,
      brand: "jack-daniel",
      sortBy: "price",
      orderBy: "asc",
      needsRedirect: true,
    });

    const href = productListRedirectHref(query, query.page);
    expect(href).toBe(
      `/products?${new URLSearchParams({
        brand: "jack-daniel",
        sortBy: "price",
        orderBy: "asc",
        ...CAMPAIGN_PARAMS,
      }).toString()}`,
    );

    // Round trip: the corrected URL is stable and still carries attribution.
    const round = parseProductListRouteQuery(
      Object.fromEntries(new URLSearchParams(href.split("?")[1] ?? "")),
    );
    expect(round.needsRedirect).toBe(false);
    expect(Object.fromEntries(round.passthrough)).toEqual(CAMPAIGN_PARAMS);
  });

  it("keeps repeated campaign values and drops only the legacy sort key", () => {
    const query = parseProductListRouteQuery({
      utm_source: ["google", "bing"],
      sort: "discount",
    });

    expect(query.needsRedirect).toBe(true);
    expect(query.passthrough).toEqual([
      ["utm_source", "google"],
      ["utm_source", "bing"],
    ]);
    expect(productListRedirectHref(query, query.page)).toBe(
      "/products?utm_source=google&utm_source=bing",
    );
  });

  it("leaves internal catalogue links free of campaign params", () => {
    const query = parseProductListRouteQuery({
      ...CAMPAIGN_PARAMS,
      brand: "jack-daniel",
    });

    expect(productListHref(query, 2)).toBe(
      "/products?brand=jack-daniel&page=2",
    );
  });

  it("rejects unsupported discount/price legacy params and unknown fields", () => {
    expect(
      parseProductListRouteQuery({ sort: "discount" as never }),
    ).toMatchObject({
      sortBy: "created_at",
      orderBy: "desc",
      needsRedirect: true,
    });
    expect(
      parseProductListRouteQuery({ sortBy: "discount", orderBy: "desc" }),
    ).toMatchObject({
      sortBy: "created_at",
      needsRedirect: true,
    });
    expect(
      parseProductListRouteQuery({ sortBy: "price", orderBy: "sideways" }),
    ).toMatchObject({
      sortBy: "price",
      orderBy: "desc",
      needsRedirect: true,
    });
  });

  it("builds canonical hrefs without default sort noise", () => {
    expect(
      productListHref(
        { sortBy: "created_at", orderBy: "desc" },
        1,
      ),
    ).toBe("/products");
    expect(
      productListHref(
        { search: "رزرو", sortBy: "price", orderBy: "asc" },
        2,
      ),
    ).toBe(
      `/products?${new URLSearchParams({
        search: "رزرو",
        sortBy: "price",
        orderBy: "asc",
        page: "2",
      }).toString()}`,
    );
  });

  it("parses human-readable brand slugs and marks numeric URLs as legacy", () => {
    expect(parseProductListRouteQuery({ brand: "jack-daniel" })).toMatchObject({
      brand: "jack-daniel",
      needsRedirect: false,
    });
    expect(parseProductListRouteQuery({ brand: " Jack-Daniel " })).toMatchObject({
      brand: "jack-daniel",
      needsRedirect: true,
    });
    expect(parseProductListRouteQuery({ brand: "jack--daniel" })).toMatchObject({
      brand: undefined,
      needsRedirect: true,
    });
    expect(parseProductListRouteQuery({ brand_id: "12" })).toMatchObject({
      legacyBrandId: 12,
      needsRedirect: true,
    });
    expect(
      productListHref(
        { brand: "jack-daniel", sortBy: "created_at", orderBy: "desc" },
        1,
      ),
    ).toBe("/products?brand=jack-daniel");
  });

  it("exposes only backend-backed sort options in the control", () => {
    const fields = new Set(
      PRODUCT_LIST_SORT_OPTIONS.map((option) => option.sortBy),
    );
    expect(fields.has("price")).toBe(true);
    expect(fields.has("discount" as never)).toBe(false);
  });
});
