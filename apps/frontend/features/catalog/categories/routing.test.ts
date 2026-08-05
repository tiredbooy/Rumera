import { describe, expect, it } from "vitest";

import {
  CATEGORY_SEARCH_MAX_LENGTH,
  categoryFilterHref,
  categoryPageHref,
  categoryPath,
  parseCategoryPage,
  parseCategoryRouteQuery,
} from "./routing";

describe("category detail routing", () => {
  it("accepts only canonical positive safe-integer pages", () => {
    expect(parseCategoryPage(undefined)).toBe(1);
    expect(parseCategoryPage("2")).toBe(2);
    expect(parseCategoryPage(String(Number.MAX_SAFE_INTEGER))).toBe(
      Number.MAX_SAFE_INTEGER,
    );

    for (const value of [
      "",
      "0",
      "-1",
      "1.5",
      "01",
      " 2",
      ["1", "2"],
      String(Number.MAX_SAFE_INTEGER + 1),
    ]) {
      expect(parseCategoryPage(value)).toBeNull();
    }
  });

  it("maps only allowlisted sort modes to supported backend fields", () => {
    expect(parseCategoryRouteQuery({})).toMatchObject({
      page: 1,
      sort: "newest",
      sortBy: "created_at",
      orderBy: "desc",
      needsRedirect: false,
    });
    expect(parseCategoryRouteQuery({ sort: "alphabetical" })).toMatchObject({
      sort: "alphabetical",
      sortBy: "title",
      orderBy: "asc",
      needsRedirect: false,
    });
    expect(parseCategoryRouteQuery({ sort: "recently-updated" })).toMatchObject(
      {
        sortBy: "updated_at",
        orderBy: "desc",
      },
    );
    expect(parseCategoryRouteQuery({ sort: "price-asc" })).toMatchObject({
      sort: "price-asc",
      sortBy: "price",
      orderBy: "asc",
      needsRedirect: false,
    });
    expect(parseCategoryRouteQuery({ sort: "price-desc" })).toMatchObject({
      sortBy: "price",
      orderBy: "desc",
    });

    for (const sort of ["price", "discount", "", ["alphabetical", "newest"]]) {
      expect(parseCategoryRouteQuery({ sort })).toMatchObject({
        sort: "newest",
        sortBy: "created_at",
        orderBy: "desc",
        needsRedirect: true,
      });
    }
    expect(parseCategoryRouteQuery({ sort: "newest" }).needsRedirect).toBe(
      true,
    );
  });

  it("trims, bounds, and canonicalizes malformed or ambiguous searches", () => {
    expect(parseCategoryRouteQuery({ q: "  تک مالت  " })).toMatchObject({
      q: "تک مالت",
      needsRedirect: true,
    });
    expect(parseCategoryRouteQuery({ q: "   " })).toMatchObject({
      q: undefined,
      needsRedirect: true,
    });
    expect(parseCategoryRouteQuery({ q: ["ویژه", "قدیمی"] })).toMatchObject({
      q: undefined,
      needsRedirect: true,
    });

    const longQuery = "آ".repeat(CATEGORY_SEARCH_MAX_LENGTH + 5);
    const parsed = parseCategoryRouteQuery({ q: longQuery });
    expect(Array.from(parsed.q ?? "")).toHaveLength(CATEGORY_SEARCH_MAX_LENGTH);
    expect(parsed.needsRedirect).toBe(true);
  });

  it("canonicalizes defaults, malformed pages, and unknown query keys", () => {
    expect(parseCategoryRouteQuery({ page: "1" }).needsRedirect).toBe(true);
    expect(parseCategoryRouteQuery({ page: "-3" })).toMatchObject({
      page: 1,
      needsRedirect: true,
    });
    expect(parseCategoryRouteQuery({ page: ["2"] })).toMatchObject({
      page: 1,
      needsRedirect: true,
    });
    expect(parseCategoryRouteQuery({ availability: "in-stock" })).toMatchObject(
      { page: 1, sort: "newest", needsRedirect: true },
    );
  });

  it("preserves canonical filters through pagination and resets page for filter changes", () => {
    const basePath = categoryPath("ویژه-a");
    const query = parseCategoryRouteQuery({
      page: "3",
      q: "تک مالت",
      sort: "alphabetical",
    });

    expect(basePath).toBe(`/categories/${encodeURIComponent("ویژه-a")}`);
    const filters = new URLSearchParams({
      q: "تک مالت",
      sort: "alphabetical",
    }).toString();
    expect(categoryPageHref(basePath, query, 4)).toBe(
      `${basePath}?${filters}&page=4`,
    );
    expect(categoryFilterHref(basePath, query)).toBe(`${basePath}?${filters}`);
    expect(categoryPageHref(basePath, { sort: "newest" }, 1)).toBe(basePath);
  });
});
