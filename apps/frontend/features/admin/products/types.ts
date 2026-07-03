// types/product.ts
import { BaseFilter } from "@/lib/types/filters";

// ------------------------------------------------
// Nested response types
// ------------------------------------------------

export interface OptionValueResponse {
  id: number;
  option_type: string; // e.g. "Color"
  value: string; // e.g. "Red"
}

export interface ImageResponse {
  id: number;
  image_url: string; // serving URL
  storage_key?: string | null; // backend key
  alt_text?: string | null;
  sort_order: number;
  is_primary: boolean;
  width?: number | null;
  height?: number | null;
}

export interface TagResponse {
  id: number;
  title: string;
}

export interface VariantResponse {
  id: number;
  sku?: string | null;
  price: number;
  compare_at_price?: number | null;
  is_active: boolean;
  options?: OptionValueResponse[]; // optional, may be omitted
  images?: ImageResponse[]; // optional
}

// ------------------------------------------------
// Core product responses
// ------------------------------------------------

// Lightweight product list item
export interface ProductListItem {
  id: number;
  title: string;
  code?: string | null;
  slug?: string | null;
  image_response?: ImageResponse | null; // matches JSON tag
  brand?: string | null; // brand title (joined)
  category?: string | null; // category title (joined)
  is_active: boolean;
  min_price: number; // cheapest variant
  max_price: number; // most expensive variant
}

// Full product detail
export interface ProductDetail {
  id: number;
  title: string;
  code?: string | null;
  slug?: string | null;
  category_id?: number | null;
  description?: string | null;
  brand_id?: number | null;
  country_of_origin?: string | null;
  abv?: number | null;
  weight?: number | null;
  is_active: boolean;
  meta_title?: string | null;
  meta_description?: string | null;
  meta_tags?: string[];
  tags?: TagResponse[];
  images?: ImageResponse[];
  variants?: VariantResponse[];
}

// Optional: MeiliSearch document shape (if used in admin search)
export interface MeiliProduct {
  id: number;
  title: string;
  code?: string | null;
  slug?: string | null;
  description?: string | null;
  brand_id?: number | null;
  category_id?: number | null;
  tags: string[]; // tag titles for full‑text search
  meta_tags: string[];
  min_price: number;
  max_price: number;
  is_active: boolean;
  country_of_origin?: string | null;
}

// ------------------------------------------------
// Request payloads
// ------------------------------------------------

// Since the exact shape of CreateVariantReq isn't provided,
// this is a reasonable assumption based on the variant response.
export interface CreateVariantReq {
  sku?: string | null;
  price: number;
  compare_at_price?: number | null;
  options?: Array<{ option_type: string; value: string }>;
  // images are usually handled separately, so not included here
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
