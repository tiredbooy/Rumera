import { describe, expect, it } from "vitest";

import {
  BRAND_CACHE_TAG,
  CATEGORY_DIRECTORY_CACHE_TAG,
  HERO_CACHE_TAG,
  HOME_CACHE_TAG,
  JOURNAL_CACHE_TAG,
  PRODUCT_CATALOGUE_CACHE_TAG,
  productDetailCacheTag,
  RECIPE_CACHE_TAG,
  RECOMMENDATION_CACHE_TAG,
  SETTINGS_CACHE_TAG,
} from "./cache-tags";
import { getAdminRevalidationPlan } from "./admin-revalidation";

describe("getAdminRevalidationPlan", () => {
  it("invalidates product catalogue, recommendations, home, and detail after product writes", () => {
    const plan = getAdminRevalidationPlan(
      ["admin", "products", "12", "images"],
      "POST",
      201,
    );

    expect(plan.tags).toEqual(
      expect.arrayContaining([
        PRODUCT_CATALOGUE_CACHE_TAG,
        RECOMMENDATION_CACHE_TAG,
        HOME_CACHE_TAG,
        CATEGORY_DIRECTORY_CACHE_TAG,
        productDetailCacheTag(12),
      ]),
    );
    expect(plan.paths).toContainEqual({ path: "/" });
    expect(plan.paths).toContainEqual({
      path: "/products/[slug]",
      type: "page",
    });
    expect(plan.paths).toContainEqual({
      path: "/categories/[slug]",
      type: "page",
    });
  });

  // Storefront settings are cached since P0-7, and the layout reads the maintenance
  // kill switch from them. Without this tag an operator closing or reopening the shop
  // waits out the TTL, so the branch existing is a correctness requirement.
  it("invalidates the storefront shell after site settings writes", () => {
    const plan = getAdminRevalidationPlan(["admin", "settings"], "PUT", 200);

    expect(plan.tags).toContain(SETTINGS_CACHE_TAG);
    expect(plan.paths).toContainEqual({ path: "/", type: "layout" });
  });

  it("invalidates product surfaces after attached product media uploads", () => {
    const plan = getAdminRevalidationPlan(
      ["admin", "uploads", "products", "42", "cover"],
      "POST",
      201,
    );
    expect(plan.tags).toContain(productDetailCacheTag(42));
    expect(plan.tags).toContain(PRODUCT_CATALOGUE_CACHE_TAG);
    expect(plan.paths).toContainEqual({ path: "/products" });
  });

  it("expires category tags and related home/product surfaces after successful writes", () => {
    const plan = getAdminRevalidationPlan(
      ["admin", "categories", "4"],
      "PATCH",
      200,
    );
    expect(plan.tags).toEqual(
      expect.arrayContaining([
        CATEGORY_DIRECTORY_CACHE_TAG,
        HOME_CACHE_TAG,
        PRODUCT_CATALOGUE_CACHE_TAG,
      ]),
    );
    expect(plan.paths).toContainEqual({ path: "/categories" });
    expect(
      getAdminRevalidationPlan(["admin", "categories", "4"], "PATCH", 500),
    ).toEqual({ tags: [], paths: [] });
  });

  it("invalidates hero and home after hero writes and hero media uploads", () => {
    expect(
      getAdminRevalidationPlan(
        ["admin", "uploads", "hero-slides", "4", "desktop"],
        "POST",
        201,
      ),
    ).toEqual({
      tags: [HERO_CACHE_TAG, HOME_CACHE_TAG],
      paths: [{ path: "/" }],
    });
    expect(
      getAdminRevalidationPlan(["admin", "hero-slides", "order"], "PUT", 204),
    ).toEqual({
      tags: [HERO_CACHE_TAG, HOME_CACHE_TAG],
      paths: [{ path: "/" }],
    });
  });

  it("does not invalidate for an unattached upload or its release", () => {
    expect(getAdminRevalidationPlan(["admin", "uploads"], "POST", 201)).toEqual(
      { tags: [], paths: [] },
    );
    expect(
      getAdminRevalidationPlan(["admin", "uploads", "release"], "POST", 204),
    ).toEqual({ tags: [], paths: [] });
  });

  it("invalidates user detail, list, and live role counts after user writes", () => {
    expect(
      getAdminRevalidationPlan(["admin", "users", "user-id"], "PATCH", 200),
    ).toEqual({
      tags: [],
      paths: [
        { path: "/admin/customers", type: "layout" },
        { path: "/admin/roles", type: "page" },
      ],
    });
  });

  it("invalidates journal surfaces after article, category, and cover writes", () => {
    const expected = {
      tags: [JOURNAL_CACHE_TAG],
      paths: [
        { path: "/journal" },
        { path: "/journal/[slug]", type: "page" as const },
        { path: "/sitemap.xml" },
        { path: "/llms.txt" },
      ],
    };
    expect(
      getAdminRevalidationPlan(["admin", "blogs", "12"], "PATCH", 200),
    ).toEqual(expected);
    expect(
      getAdminRevalidationPlan(
        ["admin", "blog-categories", "3"],
        "DELETE",
        204,
      ),
    ).toEqual(expected);
    expect(
      getAdminRevalidationPlan(
        ["admin", "uploads", "journal", "12", "cover"],
        "POST",
        201,
      ),
    ).toEqual(expected);
  });

  it("invalidates recipe surfaces after recipe and recipe media writes", () => {
    const plan = getAdminRevalidationPlan(
      ["admin", "recipes", "9"],
      "PATCH",
      200,
    );
    expect(plan.tags).toEqual(
      expect.arrayContaining([RECIPE_CACHE_TAG, HOME_CACHE_TAG]),
    );
    expect(plan.paths).toContainEqual({ path: "/recipes" });
    expect(
      getAdminRevalidationPlan(
        ["admin", "uploads", "recipes", "9", "cover"],
        "POST",
        201,
      ).tags,
    ).toContain(RECIPE_CACHE_TAG);
  });

  it("invalidates brand and home marquee after brand writes", () => {
    const plan = getAdminRevalidationPlan(
      ["admin", "brands", "3"],
      "PATCH",
      200,
    );
    expect(plan.tags).toEqual(
      expect.arrayContaining([BRAND_CACHE_TAG, HOME_CACHE_TAG]),
    );
    expect(plan.paths).toContainEqual({ path: "/" });
  });

  it("invalidates product surfaces after aggregate create/update routes", () => {
    const createPlan = getAdminRevalidationPlan(
      ["admin", "products", "aggregate"],
      "POST",
      201,
    );
    expect(createPlan.tags).toEqual(
      expect.arrayContaining([
        PRODUCT_CATALOGUE_CACHE_TAG,
        HOME_CACHE_TAG,
        HERO_CACHE_TAG,
        RECOMMENDATION_CACHE_TAG,
      ]),
    );
    expect(createPlan.paths).toContainEqual({ path: "/search" });

    const updatePlan = getAdminRevalidationPlan(
      ["admin", "products", "12", "aggregate"],
      "PUT",
      200,
    );
    expect(updatePlan.tags).toContain(productDetailCacheTag(12));
  });

  it("skips revalidation for safe methods and non-admin paths", () => {
    expect(
      getAdminRevalidationPlan(["admin", "products", "1"], "GET", 200),
    ).toEqual({ tags: [], paths: [] });
    expect(
      getAdminRevalidationPlan(["products", "1"], "PATCH", 200),
    ).toEqual({ tags: [], paths: [] });
  });
});
