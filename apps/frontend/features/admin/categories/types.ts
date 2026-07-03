// types/category.ts
import { BaseFilter } from "@/lib/types/filters";

// ------------------------------------------------
// Enums / string unions
// ------------------------------------------------

export type CardSize = "small" | "large";

// ------------------------------------------------
// Core response (full category)
// ------------------------------------------------

export interface CategoryResponse {
  id: number;
  title: string;
  description?: string | null;
  parent_id?: number | null;
  slug?: string | null;
  image_url?: string | null;
  is_featured: boolean;
  card_size?: CardSize;
  display_order: number;
}

// ------------------------------------------------
// Tree node for nested categories
// ------------------------------------------------

export interface CategoryTree {
  id: number;
  title: string;
  description?: string | null;
  slug?: string | null;
  image_url?: string | null;
  children?: CategoryTree[]; // recursive nested nodes
}

// ------------------------------------------------
// Lightweight product category (used in product responses)
// ------------------------------------------------

export interface ProductCategoryResponse {
  id: number;
  title: string;
  slug?: string | null;
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