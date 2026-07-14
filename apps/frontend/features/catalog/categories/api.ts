import type { ApiFetchOptions } from "@/lib/api/client";
import { publicRequest } from "@/lib/api/public";
import type { Paginated } from "@/lib/api/types";
import { buildQueryString } from "@/lib/utils/api-helpers";
import type {
  Category,
  CategoryListQuery,
  CategoryTree,
} from "./types";

const PUBLIC_CACHE_OPTIONS: ApiFetchOptions = {
  cache: "force-cache",
  next: { revalidate: 3600 },
};

export function listCategoryPage(
  query: CategoryListQuery = {},
): Promise<Paginated<Category>> {
  return publicRequest<Paginated<Category>>(
    `/categories${buildQueryString(query)}`,
  );
}

export async function listCategories(): Promise<Category[]> {
  try {
    const page = await publicRequest<Paginated<Category>>(
      `/categories${buildQueryString({ limit: 100 })}`,
      PUBLIC_CACHE_OPTIONS,
    );
    return page.results;
  } catch {
    return [];
  }
}

export async function getCategoryBySlug(
  slug: string,
): Promise<Category | null> {
  const categories = await listCategories();
  return categories.find((category) => category.slug === slug) ?? null;
}

export async function getCategoryTree(): Promise<CategoryTree[]> {
  try {
    return await publicRequest<CategoryTree[]>(
      "/categories/tree",
      PUBLIC_CACHE_OPTIONS,
    );
  } catch {
    return [];
  }
}

export async function getFeaturedCategories(): Promise<Category[]> {
  try {
    return await publicRequest<Category[]>(
      "/categories/featured",
      PUBLIC_CACHE_OPTIONS,
    );
  } catch {
    return [];
  }
}
