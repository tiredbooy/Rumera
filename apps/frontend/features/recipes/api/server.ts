import "server-only"

import { apiFetch } from "@/lib/api/client"
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

function emptyRecipePage(query: RecipeListQuery): Paginated<RecipeListItem> {
  return {
    results: [],
    pagination: {
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      total_items: 0,
      total_pages: 1,
      has_next: false,
      has_prev: false,
    },
  }
}

async function readPublicRecipe<T>(path: string): Promise<T | null> {
  try {
    return await publicRequest<T>(path, PUBLIC_CACHE)
  } catch {
    return null
  }
}

export async function listRecipes(
  query: RecipeListQuery = {}
): Promise<Paginated<RecipeListItem>> {
  const page = await readPublicRecipe<Paginated<RecipeListItem>>(
    `/recipes${buildQuery({ ...query })}`
  )
  return page ?? emptyRecipePage(query)
}

export async function listFeaturedRecipes(): Promise<RecipeListItem[]> {
  return (await readPublicRecipe<RecipeListItem[]>("/recipes/featured")) ?? []
}

export async function getRecipeBySlug(slug: string): Promise<RecipeDetail | null> {
  const recipe = await readPublicRecipe<RecipeDetail>(
    `/recipes/${encodeURIComponent(slug)}`
  )
  return recipe?.id ? recipe : null
}

export async function listRelatedRecipes(slug: string): Promise<RecipeListItem[]> {
  return (
    (await readPublicRecipe<RecipeListItem[]>(
      `/recipes/${encodeURIComponent(slug)}/related`
    )) ?? []
  )
}

export async function listRecipeSlugs(): Promise<string[]> {
  const items = await readPublicRecipe<RecipeSitemapItem[]>("/recipes/sitemap")
  return (items ?? []).map((item) => item.slug)
}

export function getAdminRecipe(id: number | string): Promise<AdminRecipeDetail> {
  return apiFetch<AdminRecipeDetail>(`/admin/recipes/${id}`)
}
