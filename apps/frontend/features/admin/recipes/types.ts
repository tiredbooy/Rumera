// types/recipe.ts
import { BaseFilter } from "@/lib/types/filters";

// ------------------------------------------------
// Enums / string unions
// ------------------------------------------------

export type RecipeDifficulty = "easy" | "medium" | "hard";
export type RecipeStatus = "draft" | "published" | "archived";

// ------------------------------------------------
// Nested request/response types
// ------------------------------------------------

export interface RecipeIngredientReq {
  product_variant_id?: number | null;
  ingredient_name: string;
  quantity?: number | null; // decimal
  unit?: string | null;
  optional?: boolean;
  notes?: string | null;
  sort_order?: number | null;
}

export interface RecipeProductReq {
  product_variant_id: number;
  quantity?: number | null; // decimal
  unit?: string | null;
  sort_order?: number | null;
  is_primary?: boolean;
  role?: string | null;
}

export interface RecipeIngredientResponse {
  id: number;
  product_variant_id?: number | null;
  ingredient_name: string;
  quantity?: number | null; // decimal
  unit?: string | null;
  optional: boolean;
  notes?: string | null;
  sort_order: number;
}

// Shoppable product (enriched with live catalogue data)
export interface ShoppableProduct {
  recipe_product_id: number;
  product_variant_id: number;
  product_id: number;
  product_title: string;
  product_slug?: string | null;
  brand?: string | null;
  sku?: string | null;
  price: number;
  compare_at_price?: number | null;
  image_url?: string | null;
  is_available: boolean;
  quantity?: number | null; // decimal
  unit?: string | null;
  sort_order: number;
  is_primary: boolean;
  role?: string | null;
}

export interface RecipeTagInfo {
  id: number;
  title: string;
}

// ------------------------------------------------
// Response types
// ------------------------------------------------

// Base recipe fields (shared between list and detail)
export interface RecipeResponse {
  id: number;
  title: string;
  slug: string;
  excerpt?: string | null;
  description?: string | null;
  content: string;
  difficulty: RecipeDifficulty;

  prep_time_minutes: number;
  cook_time_minutes: number;
  total_time_minutes: number; // computed (prep + cook)
  servings: number;
  calories?: number | null;

  cocktail_type?: string | null;
  glass_type?: string | null;
  serving_suggestion?: string | null;

  image_url?: string | null;

  status: RecipeStatus;
  is_featured: boolean;
  published_at?: string | null; // ISO datetime
  view_count: number;

  meta_title?: string | null;
  meta_description?: string | null;
  meta_keywords: string[];
  canonical_url?: string | null;
  og_image_url?: string | null;

  user_id?: number | null;
  created_at: string; // ISO datetime
  updated_at: string; // ISO datetime
}

// Lightweight recipe card for listings/carousels
export interface RecipeListItem {
  id: number;
  title: string;
  slug: string;
  excerpt?: string | null;
  difficulty: RecipeDifficulty;
  total_time_minutes: number;
  servings: number;
  image_url?: string | null;
  cocktail_type?: string | null;
  is_featured: boolean;
  view_count: number;
  published_at?: string | null; // ISO datetime
}

// Full detail response (includes nested relations)
export interface RecipeDetailResponse extends RecipeResponse {
  ingredients: RecipeIngredientResponse[];
  products: ShoppableProduct[];
  tags: RecipeTagInfo[];
  structured_data?: Record<string, unknown>; // schema.org JSON-LD
}

// Optional: sitemap item
export interface RecipeSitemapItem {
  slug: string;
  updated_at: string; // ISO datetime
  image_url?: string | null;
}

// ------------------------------------------------
// Request payloads
// ------------------------------------------------

export interface RecipeReq {
  title: string;
  slug?: string;
  excerpt?: string | null;
  description?: string | null;
  content: string;
  difficulty?: RecipeDifficulty;

  prep_time_minutes?: number;
  cook_time_minutes?: number;
  servings?: number;
  calories?: number | null;

  cocktail_type?: string | null;
  glass_type?: string | null;
  serving_suggestion?: string | null;

  image_url?: string | null;

  status?: RecipeStatus;
  is_featured?: boolean;
  published_at?: string | null; // ISO datetime

  meta_title?: string | null;
  meta_description?: string | null;
  meta_keywords?: string[];
  canonical_url?: string | null;
  og_image_url?: string | null;

  user_id?: number | null;

  // Relations — applied transactionally
  ingredients?: RecipeIngredientReq[];
  products?: RecipeProductReq[];
  tag_ids?: number[];
}

export interface RecipeUpdateReq {
  title?: string | null;
  slug?: string | null;
  excerpt?: string | null;
  description?: string | null;
  content?: string | null;
  difficulty?: RecipeDifficulty | null;

  prep_time_minutes?: number | null;
  cook_time_minutes?: number | null;
  servings?: number | null;
  calories?: number | null;

  cocktail_type?: string | null;
  glass_type?: string | null;
  serving_suggestion?: string | null;

  image_url?: string | null;

  status?: RecipeStatus | null;
  is_featured?: boolean | null;
  published_at?: string | null; // ISO datetime

  meta_title?: string | null;
  meta_description?: string | null;
  meta_keywords?: string[];
  canonical_url?: string | null;
  og_image_url?: string | null;

  // Relations – nil = untouched; non‑nil (including empty) = replace
  ingredients?: RecipeIngredientReq[] | null;
  products?: RecipeProductReq[] | null;
  tag_ids?: number[] | null;
}

// ------------------------------------------------
// Filter (extends BaseFilter)
// ------------------------------------------------

export interface RecipeFilter extends BaseFilter {
  status?: RecipeStatus;
  difficulty?: RecipeDifficulty;
  is_featured?: boolean;
  tag_id?: number;
  variant_id?: number; // filter by product variant
  max_time?: number; // total_time_minutes <= max_time
}
