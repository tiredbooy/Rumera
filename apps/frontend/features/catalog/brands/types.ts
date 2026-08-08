import type { PaginationQuery } from "@/lib/api/types";

/** Brand entity returned by public reads and admin mutations. */
export interface Brand {
  id: number;
  title: string;
  slug: string;
  country?: string;
  founded_year?: number;
  image_url?: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateBrandInput {
  title: string;
  slug?: string | null;
  country?: string | null;
  founded_year?: number | null;
  image_url?: string | null;
  description?: string | null;
}

/**
 * PATCH accepts null, but the current Go pointer model treats null like omission
 * and therefore cannot clear an existing nullable value.
 */
export interface UpdateBrandInput {
  title?: string | null;
  slug?: string | null;
  country?: string | null;
  founded_year?: number | null;
  image_url?: string | null;
  description?: string | null;
}

export type BrandSortField = "created_at" | "title" | "founded_year";
export type BrandSortDirection = "asc" | "desc";

export interface BrandListQuery extends PaginationQuery {
  sortBy?: BrandSortField;
  orderBy?: BrandSortDirection;
  search?: string;
  country?: string;
  founded_from?: number;
  founded_to?: number;
}
