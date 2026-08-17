import { describe, expect, it } from "vitest";

import {
  ADMIN_PRODUCTS_SEARCH_MAX_LENGTH,
  hasAdminProductListFilters,
  parseAdminProductListParams,
  productsPageHref,
} from "./products-list-params";

describe("parseAdminProductListParams", () => {
  it("defaults to page 1, no status filter, and newest sort", () => {
    expect(parseAdminProductListParams({})).toEqual({
      query: "",
      page: 1,
      isActive: undefined,
      sortBy: "created_at",
      orderBy: "desc",
    });
  });

  it("prefers q over search and trims the query", () => {
    expect(
      parseAdminProductListParams({ q: "  whisky ", search: "wine" }),
    ).toMatchObject({ query: "whisky" });
    expect(parseAdminProductListParams({ search: "  wine  " })).toMatchObject({
      query: "wine",
    });
  });

  it("caps the query length", () => {
    const long = "a".repeat(ADMIN_PRODUCTS_SEARCH_MAX_LENGTH + 20);
    expect(parseAdminProductListParams({ q: long }).query).toHaveLength(
      ADMIN_PRODUCTS_SEARCH_MAX_LENGTH,
    );
  });

  it("falls back to page 1 for invalid pages", () => {
    expect(parseAdminProductListParams({ page: "0" }).page).toBe(1);
    expect(parseAdminProductListParams({ page: "foo" }).page).toBe(1);
    expect(parseAdminProductListParams({ page: ["3"] }).page).toBe(3);
  });

  it("parses is_active only when it is a real boolean", () => {
    expect(parseAdminProductListParams({ is_active: "true" }).isActive).toBe(
      true,
    );
    expect(parseAdminProductListParams({ is_active: "false" }).isActive).toBe(
      false,
    );
    expect(
      parseAdminProductListParams({ is_active: "inactive" }).isActive,
    ).toBe(false);
    expect(parseAdminProductListParams({ is_active: "all" }).isActive).toBe(
      undefined,
    );
  });

  it("maps sort tokens and raw sortBy/orderBy to allowlisted fields", () => {
    expect(parseAdminProductListParams({ sort: "price-asc" })).toMatchObject({
      sortBy: "price",
      orderBy: "asc",
    });
    expect(
      parseAdminProductListParams({ sortBy: "title", orderBy: "asc" }),
    ).toMatchObject({
      sortBy: "title",
      orderBy: "asc",
    });
    expect(
      parseAdminProductListParams({ sortBy: "discount", orderBy: "sideways" }),
    ).toMatchObject({
      sortBy: "created_at",
      orderBy: "desc",
    });
  });
});

describe("productsPageHref", () => {
  it("omits default sort, page 1, and unset status", () => {
    expect(
      productsPageHref(
        {
          query: "",
          page: 1,
          sortBy: "created_at",
          orderBy: "desc",
        },
        1,
      ),
    ).toBe("/admin/products");
  });

  it("preserves search, status, and sort across pages", () => {
    const filters = {
      query: "wine",
      page: 2,
      isActive: false as const,
      sortBy: "title" as const,
      orderBy: "asc" as const,
    };

    expect(productsPageHref(filters, 1)).toBe(
      "/admin/products?q=wine&is_active=false&sort=title",
    );
    expect(productsPageHref(filters, 3)).toBe(
      "/admin/products?q=wine&is_active=false&sort=title&page=3",
    );
  });

  it("emits sortBy/orderBy when the pair is not a named token", () => {
    expect(
      productsPageHref(
        {
          query: "",
          page: 1,
          sortBy: "title",
          orderBy: "desc",
        },
        1,
      ),
    ).toBe("/admin/products?sortBy=title&orderBy=desc");
  });
});

describe("hasAdminProductListFilters", () => {
  it("treats query, status, and non-default sort as filters", () => {
    expect(
      hasAdminProductListFilters({
        query: "",
        page: 2,
        sortBy: "created_at",
        orderBy: "desc",
      }),
    ).toBe(false);
    expect(
      hasAdminProductListFilters({
        query: "x",
        page: 1,
        sortBy: "created_at",
        orderBy: "desc",
      }),
    ).toBe(true);
    expect(
      hasAdminProductListFilters({
        query: "",
        page: 1,
        isActive: true,
        sortBy: "created_at",
        orderBy: "desc",
      }),
    ).toBe(true);
    expect(
      hasAdminProductListFilters({
        query: "",
        page: 1,
        sortBy: "price",
        orderBy: "asc",
      }),
    ).toBe(true);
  });
});
