import type { PaginationQuery } from "@/lib/api/types";

/** Fields the product list API accepts for `sortBy` (backend allowlist). */
export type ProductSortField =
  | "created_at"
  | "title"
  | "updated_at"
  | "price";
export type ProductSortDirection = "asc" | "desc";

export const PRODUCT_SORT_FIELDS = [
  "created_at",
  "title",
  "updated_at",
  "price",
] as const satisfies readonly ProductSortField[];

export function isProductSortField(value: string): value is ProductSortField {
  return (PRODUCT_SORT_FIELDS as readonly string[]).includes(value);
}

export function isProductSortDirection(
  value: string,
): value is ProductSortDirection {
  return value === "asc" || value === "desc";
}

/** Query contract shared by public and admin product listings. */
export interface ProductListQuery extends PaginationQuery {
  sortBy?: ProductSortField;
  orderBy?: ProductSortDirection;
  search?: string;
  category_id?: number;
  /** Effective only with category_id; includes that category's full subtree. */
  include_descendants?: boolean;
  brand_id?: number;
  /** Public, stable brand slug filter. */
  brand?: string;
  tag_id?: number;
  is_active?: boolean;
  min_price?: number;
  max_price?: number;
}

export type PublicProductListQuery = Omit<ProductListQuery, "is_active">;
