import "server-only";

import type { ApiFetchOptions } from "@/lib/api/client";
import { isApiNotFoundError } from "@/lib/api/error-semantics";
import { publicRequest } from "@/lib/api/public";
import type { Paginated } from "@/lib/api/types";
import {
  CATEGORY_DIRECTORY_CACHE_TAG,
  HOME_CACHE_TAG,
} from "@/lib/cache-tags";
import { buildQueryString } from "@/lib/utils/api-helpers";
import type { Category, CategoryListQuery, CategoryTree } from "./types";

const PUBLIC_DIRECTORY_CACHE_OPTIONS: ApiFetchOptions = {
  cache: "force-cache",
  next: {
    revalidate: 3600,
    tags: [CATEGORY_DIRECTORY_CACHE_TAG, HOME_CACHE_TAG],
  },
};
const PUBLIC_DETAIL_CACHE_OPTIONS: ApiFetchOptions = { cache: "no-store" };

export function listCategoryPage(
  query: CategoryListQuery = {},
): Promise<Paginated<Category>> {
  return publicRequest<Paginated<Category>>(
    `/categories${buildQueryString(query)}`,
    PUBLIC_DIRECTORY_CACHE_OPTIONS,
  );
}

export async function listCategories(): Promise<Category[]> {
  const categories: Category[] = [];
  let page = 1;

  for (;;) {
    const result = await listCategoryPage({ page, limit: 100 });
    categories.push(...result.results);
    if (!result.pagination.has_next || result.results.length === 0) {
      return categories;
    }
    page += 1;
  }
}

export async function getCategoryBySlug(
  slug: string,
): Promise<Category | null> {
  try {
    return await publicRequest<Category>(
      `/categories/slug/${encodeURIComponent(slug)}`,
      PUBLIC_DETAIL_CACHE_OPTIONS,
    );
  } catch (error) {
    if (isApiNotFoundError(error)) return null;
    throw error;
  }
}

export async function allCategorySlugs(): Promise<string[]> {
  return (await listCategories()).flatMap((category) => {
    const slug = category.slug?.trim();
    return slug ? [slug] : [];
  });
}

/**
 * The storefront layout awaits this on every public page, so `no-store` here made
 * home, PDP, PLP, categories, journal, recipes, about and FAQ dynamic and defeated
 * every `revalidate` below it. It is the same directory data as
 * `listCategoryPage`/`getFeaturedCategories` and admin category writes already blow
 * CATEGORY_DIRECTORY_CACHE_TAG, so it needs no invalidation of its own.
 */
export function getCategoryTree(): Promise<CategoryTree[]> {
  return publicRequest<CategoryTree[]>(
    "/categories/tree",
    PUBLIC_DIRECTORY_CACHE_OPTIONS,
  );
}

export function getFeaturedCategories(): Promise<Category[]> {
  return publicRequest<Category[]>(
    "/categories/featured",
    PUBLIC_DIRECTORY_CACHE_OPTIONS,
  );
}
