import { describe, expect, it } from "vitest";

import {
  RECIPE_SEARCH_MAX_LENGTH,
  parseRecipePage,
  parseRecipeRouteQuery,
  recipePageHref,
  recipeRedirectHref,
} from "./routing";

describe("recipe routing", () => {
  it("accepts only canonical positive safe-integer pages", () => {
    expect(parseRecipePage(undefined)).toBe(1);
    expect(parseRecipePage("3")).toBe(3);
    for (const value of [
      "",
      "0",
      "-1",
      "1.5",
      "1e2",
      "01",
      ["1", "2"],
      String(Number.MAX_SAFE_INTEGER + 1),
    ]) {
      expect(parseRecipePage(value)).toBeNull();
    }
  });

  it("maps difficulty and sort values to the real backend query contract", () => {
    expect(
      parseRecipeRouteQuery({ difficulty: "medium", sort: "quick" }),
    ).toMatchObject({
      difficulty: "medium",
      sort: "quick",
      sortBy: "total_time",
      orderBy: "asc",
      needsRedirect: false,
    });
    expect(parseRecipeRouteQuery({ sort: "popular" })).toMatchObject({
      sortBy: "view_count",
      orderBy: "desc",
    });

    for (const params of [
      { difficulty: "expert" },
      { difficulty: ["easy", "hard"] },
      { sort: "price" },
      { sort: "new" },
    ]) {
      expect(parseRecipeRouteQuery(params)).toMatchObject({
        needsRedirect: true,
      });
    }
  });

  it("trims, bounds, and canonicalizes search and unknown state", () => {
    expect(parseRecipeRouteQuery({ q: "  موخیتو  " })).toMatchObject({
      q: "موخیتو",
      needsRedirect: true,
    });
    expect(parseRecipeRouteQuery({ q: ["الف", "ب"] })).toMatchObject({
      q: undefined,
      needsRedirect: true,
    });
    expect(parseRecipeRouteQuery({ q: "" })).toMatchObject({
      q: undefined,
      needsRedirect: true,
    });
    // U-4: a campaign param is not a malformed URL. It rides along instead of
    // triggering a redirect that would strip it before analytics ever saw it.
    expect(parseRecipeRouteQuery({ tag: "7" }).needsRedirect).toBe(false);

    const campaign = parseRecipeRouteQuery({ page: "1", utm_campaign: "eid" });
    expect(campaign.needsRedirect).toBe(true);
    expect(recipeRedirectHref(campaign, campaign.page)).toContain(
      "utm_campaign=eid",
    );
    expect(recipePageHref(campaign, 2)).not.toContain("utm_campaign");

    const parsed = parseRecipeRouteQuery({
      q: "آ".repeat(RECIPE_SEARCH_MAX_LENGTH + 4),
    });
    expect(Array.from(parsed.q ?? "")).toHaveLength(RECIPE_SEARCH_MAX_LENGTH);
  });

  it("preserves parsed filters through pagination and omits defaults", () => {
    const query = parseRecipeRouteQuery({
      q: "لیموناد",
      difficulty: "easy",
      sort: "quick",
    });
    const expected = new URLSearchParams({
      q: "لیموناد",
      difficulty: "easy",
      sort: "quick",
      page: "2",
    }).toString();

    expect(recipePageHref(query, 2, "recipe-results-title")).toBe(
      `/recipes?${expected}#recipe-results-title`,
    );
    expect(recipePageHref({ sort: "new" }, 1)).toBe("/recipes");
  });
});
