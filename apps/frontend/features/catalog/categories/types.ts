import type { PaginationQuery } from "@/lib/api/types";

export type CardSize = "small" | "large";

/** Flat category returned by list, detail, featured, and mutation endpoints. */
export interface Category {
  id: number;
  title: string;
  description?: string;
  parent_id?: number;
  slug?: string;
  image_url?: string;
  is_featured: boolean;
  card_size?: CardSize;
  display_order: number;
}

/** Nested tree structure for hierarchical categories. */
export interface CategoryTree {
  id: number;
  title: string;
  description?: string;
  slug?: string;
  image_url?: string;
  children?: CategoryTree[];
}

/** Lightweight category reference used inside product responses. */
export interface ProductCategory {
  id: number;
  title: string;
  slug: string | null;
}

export interface CreateCategoryInput {
  title: string;
  description?: string | null;
  parent_id?: number | null;
  slug?: string | null;
  image_url?: string | null;
  is_featured?: boolean | null;
  card_size?: CardSize | null;
  display_order?: number | null;
}

export interface UpdateCategoryInput {
  title?: string | null;
  description?: string | null;
  parent_id?: number | null;
  slug?: string | null;
  image_url?: string | null;
  is_featured?: boolean | null;
  card_size?: CardSize | null;
  display_order?: number | null;
}

export type CategorySortField = "created_at" | "title" | "display_order";
export type CategorySortDirection = "asc" | "desc";

export interface CategoryListQuery extends PaginationQuery {
  sortBy?: CategorySortField;
  orderBy?: CategorySortDirection;
  search?: string;
  parent_id?: number;
  is_featured?: boolean;
}
