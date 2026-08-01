import { describe, expect, it } from "vitest";

import { CATEGORY_DIRECTORY_CACHE_TAG, JOURNAL_CACHE_TAG } from "./cache-tags";
import { getAdminRevalidationPlan } from "./admin-revalidation";

describe("getAdminRevalidationPlan", () => {
  it("invalidates home and product surfaces after product image writes", () => {
    const plan = getAdminRevalidationPlan(
      ["admin", "products", "12", "images"],
      "POST",
      201,
    );

    expect(plan.paths).toContainEqual({ path: "/" });
    expect(plan.paths).toContainEqual({
      path: "/products/[slug]",
      type: "page",
    });
  });

  it("expires category tags and the uncached hero route only after successful writes", () => {
    expect(
      getAdminRevalidationPlan(["admin", "categories", "4"], "PATCH", 200).tags,
    ).toEqual([CATEGORY_DIRECTORY_CACHE_TAG]);
    expect(
      getAdminRevalidationPlan(
        ["admin", "uploads", "hero-slides", "4", "desktop"],
        "POST",
        201,
      ),
    ).toEqual({ tags: [], paths: [{ path: "/" }] });
    expect(
      getAdminRevalidationPlan(["admin", "categories", "4"], "PATCH", 500),
    ).toEqual({ tags: [], paths: [] });
    expect(
      getAdminRevalidationPlan(["admin", "hero-slides", "order"], "PUT", 204),
    ).toEqual({
      tags: [],
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
});
