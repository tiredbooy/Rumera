// features/admin/products/types.ts
//
// Admin-only request/filter payloads. Entity and response shapes
// (ImageResponse, ProductDetail, VariantResponse, TagResponse, etc.)
// live in features/catalog/products/types.ts — import them from there
// rather than redefining them here, to avoid drift like the
// alt_text null/undefined bug.

import type { BaseFilter } from "@/lib/types/filters";
import type {
  ProductDetail,
  ProductListItem,
  ImageResponse,
  VariantResponse,
  TagResponse,
  OptionValueResponse,
  MeiliProduct,
} from "@/features/catalog/products/types";

// Re-exported for convenience so admin code can import everything
// product-related from one place if desired.
export type {
  ProductDetail,
  ProductListItem,
  ImageResponse,
  VariantResponse,
  TagResponse,
  OptionValueResponse,
  MeiliProduct,
};

// ------------------------------------------------
// Request payloads (admin writes only)
// ------------------------------------------------

export interface CreateVariantReq {
  sku?: string | null;
  price: number;
  compare_at_price?: number | null;
  options?: Array<{ option_type: string; value: string }>;
  // images are handled separately via the images API, not included here
}

export interface CreateProductReq {
  title: string;
  code?: string | null;
  slug?: string | null;
  category_id?: number | null;
  description?: string | null;
  brand_id?: number | null;
  country_of_origin?: string | null;
  abv?: number | null;
  weight?: number | null;
  meta_title?: string | null;
  meta_description?: string | null;
  meta_tags?: string[];
  tag_ids?: number[]; // tag IDs for junction
  variants: CreateVariantReq[]; // created together with product
}

export interface UpdateProductReq {
  title?: string | null;
  code?: string | null;
  slug?: string | null;
  category_id?: number | null;
  description?: string | null;
  brand_id?: number | null;
  country_of_origin?: string | null;
  abv?: number | null;
  weight?: number | null;
  is_active?: boolean;
  meta_title?: string | null;
  meta_description?: string | null;
  meta_tags?: string[];
  tag_ids?: number[];
}

// ------------------------------------------------
// Filter (extends BaseFilter)
// ------------------------------------------------

export interface ProductFilter extends BaseFilter {
  category_id?: number;
  brand_id?: number;
  tag_id?: number;
  is_active?: boolean;
  min_price?: number;
  max_price?: number;
}
