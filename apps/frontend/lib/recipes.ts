/**
 * Live recipe fetchers (server-side, ISR-cached) backed by the Go recipes API.
 *
 * Mirrors the catalogue fetchers in `lib/catalog`: error-safe (returns sane
 * fallbacks when the backend is unreachable so `next build` and rendering never
 * hard-fail) and ISR-cached. Public reads are published-only on the backend.
 *
 *   GET /recipes              → { results, pagination } of RecipeListItem
 *   GET /recipes/featured     → { data } RecipeListItem[]
 *   GET /recipes/:slug        → RecipeDetail (top-level, ETag/revalidate)
 *   GET /recipes/:slug/related→ { data } RecipeListItem[]
 *   GET /recipes/sitemap      → { data } RecipeSitemapItem[]
 */
import { buildQuery } from "@/lib/api/qs"
import { faNum } from "@/lib/products"
import type { Paginated } from "@/lib/catalog/types"

const API = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"
const BASE = `${API.replace(/\/$/, "")}/api/v1`
const REVALIDATE = 3600

export type RecipeDifficulty = "easy" | "medium" | "hard"

export type RecipeListItem = {
  id: number
  title: string
  slug: string
  excerpt: string | null
  difficulty: RecipeDifficulty
  total_time_minutes: number
  servings: number
  image_url: string | null
  cocktail_type: string | null
  is_featured: boolean
  view_count: number
  published_at: string | null
}

export type RecipeIngredient = {
  id: number
  product_variant_id: number | null
  ingredient_name: string
  quantity: string | null
  unit: string | null
  optional: boolean
  notes: string | null
  sort_order: number
}

/** A recipe's linked product, enriched with live catalogue data for upsell. */
export type ShoppableProduct = {
  recipe_product_id: number
  product_variant_id: number
  product_id: number
  product_title: string
  product_slug: string | null
  brand?: string | null
  sku?: string | null
  price: number
  compare_at_price?: number | null
  image_url?: string | null
  is_available: boolean
  quantity?: string | null
  unit?: string | null
  sort_order: number
  is_primary: boolean
  role?: string | null
}

export type RecipeTagInfo = { id: number; title: string }

export type RecipeDetail = {
  id: number
  title: string
  slug: string
  excerpt: string | null
  description: string | null
  content: string
  difficulty: RecipeDifficulty
  prep_time_minutes: number
  cook_time_minutes: number
  total_time_minutes: number
  servings: number
  calories: number | null
  cocktail_type: string | null
  glass_type: string | null
  serving_suggestion: string | null
  image_url: string | null
  is_featured: boolean
  published_at: string | null
  view_count: number
  meta_title: string | null
  meta_description: string | null
  og_image_url: string | null
  ingredients: RecipeIngredient[]
  products: ShoppableProduct[]
  tags: RecipeTagInfo[]
  structured_data?: Record<string, unknown>
}

export type RecipeListParams = {
  page?: number
  limit?: number
  search?: string
  difficulty?: RecipeDifficulty
  is_featured?: boolean
  tag_id?: number
  max_time?: number
  sortBy?: "published_at" | "view_count" | "total_time_minutes" | "title"
  orderBy?: "asc" | "desc"
}

const emptyPage = <T>(): Paginated<T> => ({
  results: [],
  pagination: { page: 1, limit: 0, total_items: 0, total_pages: 0, has_next: false, has_prev: false },
})

async function publicGet<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${BASE}${path}`, { next: { revalidate: REVALIDATE } })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

export async function listRecipes(params: RecipeListParams = {}): Promise<Paginated<RecipeListItem>> {
  const page = await publicGet<Paginated<RecipeListItem>>(`/recipes${buildQuery(params)}`)
  return page ?? emptyPage<RecipeListItem>()
}

export async function getFeaturedRecipes(): Promise<RecipeListItem[]> {
  const body = await publicGet<{ data?: RecipeListItem[] } | RecipeListItem[]>("/recipes/featured")
  if (!body) return []
  return Array.isArray(body) ? body : (body.data ?? [])
}

export async function getRecipeBySlug(slug: string): Promise<RecipeDetail | null> {
  // Detail is returned top-level (not wrapped in { data }).
  const body = await publicGet<RecipeDetail>(`/recipes/${encodeURIComponent(slug)}`)
  return body && body.id ? body : null
}

export async function getRelatedRecipes(slug: string): Promise<RecipeListItem[]> {
  const body = await publicGet<{ data?: RecipeListItem[] } | RecipeListItem[]>(
    `/recipes/${encodeURIComponent(slug)}/related`
  )
  if (!body) return []
  return Array.isArray(body) ? body : (body.data ?? [])
}

/** All published slugs for generateStaticParams (returns [] on failure → on-demand ISR). */
export async function allRecipeSlugs(): Promise<string[]> {
  const body = await publicGet<{ data?: { slug: string }[] } | { slug: string }[]>("/recipes/sitemap")
  const items = Array.isArray(body) ? body : (body?.data ?? [])
  return items.map((i) => i.slug)
}

// ── Display helpers ────────────────────────────────────────────────────────────

export const difficultyFa: Record<RecipeDifficulty, string> = {
  easy: "آسان",
  medium: "متوسط",
  hard: "پیشرفته",
}

/** Minutes → Persian duration, e.g. ۵ دقیقه / ۱ ساعت و ۳۰ دقیقه. */
export function formatDuration(minutes: number): string {
  if (!minutes || minutes <= 0) return "—"
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h > 0 && m > 0) return `${faNum(h)} ساعت و ${faNum(m)} دقیقه`
  if (h > 0) return `${faNum(h)} ساعت`
  return `${faNum(m)} دقیقه`
}
