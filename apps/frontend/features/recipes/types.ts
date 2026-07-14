import type { PaginationQuery } from "@/lib/api/types"

export type RecipeDifficulty = "easy" | "medium" | "hard"
export type RecipeStatus = "draft" | "published" | "archived"

/** Lightweight public card returned by list, featured, and related endpoints. */
export interface RecipeListItem {
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

/** Base fields returned by hydrated recipe detail and admin mutation endpoints. */
export interface RecipeResponse {
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
  status: RecipeStatus
  is_featured: boolean
  published_at: string | null
  view_count: number
  meta_title: string | null
  meta_description: string | null
  meta_keywords: string[] | null
  canonical_url: string | null
  og_image_url: string | null
  user_id: number | null
  created_at: string
  updated_at: string
}

export interface RecipeIngredient {
  id: number
  product_variant_id: number | null
  ingredient_name: string
  quantity: string | null
  unit: string | null
  optional: boolean
  notes: string | null
  sort_order: number
}

/** A linked product enriched with current catalogue price and availability. */
export interface ShoppableProduct {
  recipe_product_id: number
  product_variant_id: number
  product_id: number
  product_title: string
  product_slug: string | null
  brand?: string
  sku?: string
  price: number
  compare_at_price?: number
  image_url?: string
  is_available: boolean
  quantity?: string
  unit?: string
  sort_order: number
  is_primary: boolean
  role?: string
}

export interface RecipeTagInfo {
  id: number
  title: string
}

export interface RecipeDetail extends RecipeResponse {
  ingredients: RecipeIngredient[]
  products: ShoppableProduct[]
  tags: RecipeTagInfo[]
  structured_data: Record<string, unknown>
}

export interface RecipeSitemapItem {
  slug: string
  updated_at: string
  image_url?: string
}

export type RecipeSortField =
  | "published_at"
  | "created_at"
  | "updated_at"
  | "title"
  | "view_count"
  | "total_time"

export type RecipeSortDirection = "asc" | "desc"

export type RecipeListQuery = PaginationQuery & {
  search?: string
  difficulty?: RecipeDifficulty
  is_featured?: boolean
  tag_id?: number
  variant_id?: number
  max_time?: number
  sortBy?: RecipeSortField
  orderBy?: RecipeSortDirection
}

/** Admin list projection adds workflow state and audit timestamps to the card. */
export interface AdminRecipeListItem extends RecipeListItem {
  status: RecipeStatus
  created_at: string
  updated_at: string
}

/** Admin detail uses the backend's full hydrated recipe projection. */
export type AdminRecipeDetail = RecipeDetail

export interface RecipeIngredientInput {
  product_variant_id?: number | null
  ingredient_name: string
  quantity?: string | null
  unit?: string | null
  optional?: boolean
  notes?: string | null
  sort_order?: number | null
}

export interface RecipeProductInput {
  product_variant_id: number
  quantity?: string | null
  unit?: string | null
  sort_order?: number | null
  is_primary?: boolean
  role?: string | null
}

export interface CreateRecipeInput {
  title: string
  slug?: string | null
  excerpt?: string | null
  description?: string | null
  content: string
  difficulty?: RecipeDifficulty
  prep_time_minutes?: number
  cook_time_minutes?: number
  servings?: number
  calories?: number | null
  cocktail_type?: string | null
  glass_type?: string | null
  serving_suggestion?: string | null
  image_url?: string | null
  status?: RecipeStatus
  is_featured?: boolean
  published_at?: string | null
  meta_title?: string | null
  meta_description?: string | null
  meta_keywords?: string[] | null
  canonical_url?: string | null
  og_image_url?: string | null
  user_id?: number | null
  ingredients?: RecipeIngredientInput[] | null
  products?: RecipeProductInput[] | null
  tag_ids?: number[] | null
}

export interface UpdateRecipeInput {
  title?: string | null
  slug?: string | null
  excerpt?: string | null
  description?: string | null
  content?: string | null
  difficulty?: RecipeDifficulty | null
  prep_time_minutes?: number | null
  cook_time_minutes?: number | null
  servings?: number | null
  calories?: number | null
  cocktail_type?: string | null
  glass_type?: string | null
  serving_suggestion?: string | null
  image_url?: string | null
  status?: RecipeStatus | null
  is_featured?: boolean | null
  published_at?: string | null
  meta_title?: string | null
  meta_description?: string | null
  meta_keywords?: string[] | null
  canonical_url?: string | null
  og_image_url?: string | null
  ingredients?: RecipeIngredientInput[] | null
  products?: RecipeProductInput[] | null
  tag_ids?: number[] | null
}

export type AdminRecipeListQuery = PaginationQuery & {
  search?: string
  status?: RecipeStatus
  difficulty?: RecipeDifficulty
  is_featured?: boolean
  tag_id?: number
  variant_id?: number
  max_time?: number
  sortBy?: RecipeSortField
  orderBy?: RecipeSortDirection
}
