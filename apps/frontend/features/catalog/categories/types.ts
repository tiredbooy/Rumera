// types/category.ts
import { BaseFilter } from "@/lib/types/filters";

// ------------------------------------------------
// Enums / string unions
// ------------------------------------------------

export type CardSize = "small" | "large";

// ------------------------------------------------
// Public responses (no timestamps)
// ------------------------------------------------

/** Basic category info – used in storefront and product listings. */
export interface CategoryResponse {
  id: number;
  title: string;
  description?: string | null;
  parent_id?: number | null;
  slug?: string | null;
  image_url?: string | null;
  is_featured: boolean;
  card_size?: CardSize; // "small" | "large", may be omitted if default
  display_order: number;
}

/** Nested tree structure for hierarchical categories. */
export interface CategoryTree {
  id: number;
  title: string;
  description?: string | null;
  slug?: string | null;
  image_url?: string | null;
  children?: CategoryTree[]; // recursive
}

/** Lightweight category reference used inside product responses. */
export interface ProductCategoryResponse {
  id: number;
  title: string;
  slug?: string | null;
}

// ------------------------------------------------
// Admin responses (extend public with timestamps)
// ------------------------------------------------

/** Full category record for admin – includes audit timestamps. */
export interface AdminCategoryResponse extends CategoryResponse {
  created_at: string; // ISO datetime
  updated_at: string; // ISO datetime
}

// ------------------------------------------------
// Request payloads
// ------------------------------------------------

export interface CreateCategoryReq {
  title: string;
  description?: string | null;
  parent_id?: number | null;
  slug?: string | null;
  image_url?: string | null;
  is_featured?: boolean;
  card_size?: CardSize;
  display_order?: number; // int16
}

export interface UpdateCategoryReq {
  title?: string | null;
  description?: string | null;
  parent_id?: number | null;
  slug?: string | null;
  image_url?: string | null;
  is_featured?: boolean;
  card_size?: CardSize;
  display_order?: number;
}

// ------------------------------------------------
// Filter (extends BaseFilter)
// ------------------------------------------------

export interface CategoryFilter extends BaseFilter {
  parent_id?: number;
  is_featured?: boolean;
}

export type Category = CategoryResponse;
