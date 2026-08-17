import {
  BRAND_CACHE_TAG,
  CATEGORY_DIRECTORY_CACHE_TAG,
  HERO_CACHE_TAG,
  HOME_CACHE_TAG,
  HOME_SURFACE_TAGS,
  JOURNAL_CACHE_TAG,
  PRODUCT_CATALOGUE_CACHE_TAG,
  productDetailCacheTag,
  RECIPE_CACHE_TAG,
  RECOMMENDATION_CACHE_TAG,
  SETTINGS_CACHE_TAG,
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

const PRODUCT_SURFACE_PATHS: RevalidationPath[] = [
  { path: "/" },
  { path: "/products" },
  { path: "/products/[slug]", type: "page" },
  { path: "/categories/[slug]", type: "page" },
  { path: "/search" },
];

const CATEGORY_SURFACE_PATHS: RevalidationPath[] = [
  { path: "/" },
  { path: "/categories" },
  { path: "/categories/[slug]", type: "page" },
  { path: "/products" },
];

const HERO_SURFACE_PATHS: RevalidationPath[] = [{ path: "/" }];

const RECIPE_SURFACE_PATHS: RevalidationPath[] = [
  { path: "/" },
  { path: "/recipes" },
  { path: "/recipes/[slug]", type: "page" },
];

const JOURNAL_SURFACE_PATHS: RevalidationPath[] = [
  { path: "/journal" },
  { path: "/journal/[slug]", type: "page" },
  { path: "/sitemap.xml" },
  { path: "/llms.txt" },
];

function uniqueTags(tags: string[]): string[] {
  return [...new Set(tags.filter(Boolean))];
}

function numericSegment(value: string | undefined): string | null {
  if (!value || !/^\d+$/.test(value)) return null;
  return value;
}

function productWritePlan(productId: string | null): AdminRevalidationPlan {
  const tags = uniqueTags([
    ...HOME_SURFACE_TAGS,
    PRODUCT_CATALOGUE_CACHE_TAG,
    RECOMMENDATION_CACHE_TAG,
    HOME_CACHE_TAG,
    CATEGORY_DIRECTORY_CACHE_TAG,
    productId ? productDetailCacheTag(productId) : "",
  ]);
  return { tags, paths: PRODUCT_SURFACE_PATHS };
}

function categoryWritePlan(): AdminRevalidationPlan {
  return {
    tags: uniqueTags([
      CATEGORY_DIRECTORY_CACHE_TAG,
      HOME_CACHE_TAG,
      PRODUCT_CATALOGUE_CACHE_TAG,
      RECOMMENDATION_CACHE_TAG,
    ]),
    paths: CATEGORY_SURFACE_PATHS,
  };
}

function heroWritePlan(): AdminRevalidationPlan {
  return {
    tags: uniqueTags([HERO_CACHE_TAG, HOME_CACHE_TAG]),
    paths: HERO_SURFACE_PATHS,
  };
}

function recipeWritePlan(): AdminRevalidationPlan {
  return {
    tags: uniqueTags([RECIPE_CACHE_TAG, HOME_CACHE_TAG]),
    paths: RECIPE_SURFACE_PATHS,
  };
}

function journalWritePlan(): AdminRevalidationPlan {
  return {
    tags: uniqueTags([JOURNAL_CACHE_TAG]),
    paths: JOURNAL_SURFACE_PATHS,
  };
}

function brandWritePlan(): AdminRevalidationPlan {
  return {
    tags: uniqueTags([BRAND_CACHE_TAG, HOME_CACHE_TAG, PRODUCT_CATALOGUE_CACHE_TAG]),
    paths: [{ path: "/" }, { path: "/products" }],
  };
}

/**
 * Settings reach every storefront page through the layout, so the whole shell is
 * the blast radius. `type: "layout"` on `/` covers the nested route groups.
 */
function settingsWritePlan(): AdminRevalidationPlan {
  return {
    tags: uniqueTags([SETTINGS_CACHE_TAG]),
    paths: [{ path: "/", type: "layout" }],
  };
}

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
    return productWritePlan(numericSegment(segments[2]));
  }
  if (resource === "categories") {
    return categoryWritePlan();
  }
  if (resource === "settings") {
    return settingsWritePlan();
  }
  if (resource === "hero-slides") {
    return heroWritePlan();
  }
  if (resource === "brands") {
    return brandWritePlan();
  }
  if (resource === "tags") {
    // Tags appear on product cards and catalogue filters.
    return {
      tags: uniqueTags([
        PRODUCT_CATALOGUE_CACHE_TAG,
        HOME_CACHE_TAG,
        RECOMMENDATION_CACHE_TAG,
      ]),
      paths: [
        { path: "/" },
        { path: "/products" },
        { path: "/products/[slug]", type: "page" },
        { path: "/tags" },
        { path: "/tags/[slug]", type: "page" },
      ],
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
    return recipeWritePlan();
  }
  if (resource === "blogs" || resource === "blog-categories") {
    return journalWritePlan();
  }

  // Attached media uploads: /admin/uploads/{ownerType}/{ownerId}/{role}
  if (resource === "uploads" && segments.length >= 5) {
    const ownerType = segments[2];
    const ownerId = numericSegment(segments[3]);
    switch (ownerType) {
      case "products":
      case "product":
        return productWritePlan(ownerId);
      case "categories":
      case "category":
        return categoryWritePlan();
      case "hero-slides":
      case "hero":
        return heroWritePlan();
      case "recipes":
      case "recipe":
        return recipeWritePlan();
      case "journal":
      case "blogs":
      case "blog":
        return journalWritePlan();
      case "brands":
      case "brand":
        return brandWritePlan();
      default:
        return EMPTY_PLAN;
    }
  }

  return EMPTY_PLAN;
}
