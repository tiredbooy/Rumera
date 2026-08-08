import { describe, expect, it } from "vitest";

import {
  parseProductListRouteQuery,
  productListHref,
  PRODUCT_LIST_SORT_OPTIONS,
} from "./list-routing";

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
