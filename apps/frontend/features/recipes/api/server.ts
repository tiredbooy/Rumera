import "server-only"

import { apiFetch } from "@/lib/api/client"
import { isApiNotFoundError } from "@/lib/api/error-semantics"
import { publicRequest } from "@/lib/api/public"
import { buildQuery } from "@/lib/api/qs"
import type { Paginated } from "@/lib/api/types"

import type {
  AdminRecipeDetail,
  RecipeDetail,
  RecipeListItem,
  RecipeListQuery,
  RecipeSitemapItem,
} from "../types"

const PUBLIC_CACHE = {
  cache: "force-cache" as const,
  next: { revalidate: 3600 },
}

export async function listRecipes(
  query: RecipeListQuery = {},
): Promise<Paginated<RecipeListItem>> {
  return publicRequest<Paginated<RecipeListItem>>(
    `/recipes${buildQuery({ ...query })}`,
    PUBLIC_CACHE,
  )
}

export async function listFeaturedRecipes(): Promise<RecipeListItem[]> {
  return publicRequest<RecipeListItem[]>("/recipes/featured", PUBLIC_CACHE)
}

export async function getRecipeBySlug(
  slug: string,
): Promise<RecipeDetail | null> {
  try {
    return await publicRequest<RecipeDetail>(
      `/recipes/${encodeURIComponent(slug)}`,
      PUBLIC_CACHE,
    )
  } catch (error) {
    if (isApiNotFoundError(error)) return null
    throw error
  }
}

export async function listRelatedRecipes(
  slug: string,
): Promise<RecipeListItem[]> {
  return publicRequest<RecipeListItem[]>(
    `/recipes/${encodeURIComponent(slug)}/related`,
    PUBLIC_CACHE,
  )
}

export async function listRecipeSlugs(): Promise<string[]> {
  const items = await publicRequest<RecipeSitemapItem[]>(
    "/recipes/sitemap",
    PUBLIC_CACHE,
  )
  return items.map((item) => item.slug)
}

export function getAdminRecipe(
  id: number | string,
): Promise<AdminRecipeDetail> {
  return apiFetch<AdminRecipeDetail>(`/admin/recipes/${id}`)
}
