import {
  CATEGORY_DIRECTORY_CACHE_TAG,
  JOURNAL_CACHE_TAG,
} from "@/lib/cache-tags";

export type RevalidationPath = {
  path: string;
  type?: "page" | "layout";
};

export type AdminRevalidationPlan = {
  tags: string[];
  paths: RevalidationPath[];
};

const EMPTY_PLAN: AdminRevalidationPlan = { tags: [], paths: [] };

/** Returns the storefront cache entries directly affected by an admin write. */
export function getAdminRevalidationPlan(
  segments: string[],
  method: string,
  status: number,
): AdminRevalidationPlan {
  if (
    segments[0] !== "admin" ||
    method === "GET" ||
    method === "HEAD" ||
    status < 200 ||
    status >= 300
  ) {
    return EMPTY_PLAN;
  }

  const resource = segments[1];
  if (resource === "products") {
    return {
      tags: [],
      paths: [
        { path: "/" },
        { path: "/products" },
        { path: "/products/[slug]", type: "page" },
        { path: "/categories/[slug]", type: "page" },
      ],
    };
  }
  if (resource === "categories") {
    return {
      tags: [CATEGORY_DIRECTORY_CACHE_TAG],
      paths: [
        { path: "/" },
        { path: "/categories" },
        { path: "/categories/[slug]", type: "page" },
      ],
    };
  }
  if (resource === "hero-slides") {
    return {
      tags: [],
      paths: [{ path: "/" }],
    };
  }
  if (resource === "users") {
    return {
      tags: [],
      paths: [
        { path: "/admin/customers", type: "layout" },
        { path: "/admin/roles", type: "page" },
      ],
    };
  }
  if (resource === "recipes") {
    return {
      tags: [],
      paths: [{ path: "/recipes" }, { path: "/recipes/[slug]", type: "page" }],
    };
  }
  if (resource === "blogs" || resource === "blog-categories") {
    return {
      tags: [JOURNAL_CACHE_TAG],
      paths: [
        { path: "/journal" },
        { path: "/journal/[slug]", type: "page" },
        { path: "/sitemap.xml" },
        { path: "/llms.txt" },
      ],
    };
  }
  if (resource !== "uploads" || segments.length < 5) return EMPTY_PLAN;

  switch (segments[2]) {
    case "hero-slides":
      return {
        tags: [],
        paths: [{ path: "/" }],
      };
    case "recipes":
      return {
        tags: [],
        paths: [
          { path: "/recipes" },
          { path: "/recipes/[slug]", type: "page" },
        ],
      };
    case "journal":
      return {
        tags: [JOURNAL_CACHE_TAG],
        paths: [
          { path: "/journal" },
          { path: "/journal/[slug]", type: "page" },
          { path: "/sitemap.xml" },
          { path: "/llms.txt" },
        ],
      };
    default:
      return EMPTY_PLAN;
  }
}
