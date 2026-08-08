// features/catalog/products/types.ts
//
// Mirrors backend/models/product_response.go exactly.
// Do not hand-edit fields without checking the Go source first —
// drift here is what caused the alt_text null/undefined bug.

import type { ProductTag } from "@/features/catalog/tags/types";

export interface ProductImage {
  id: number;
  image_url: string; // canonical serving URL (/media/{key} for uploads)
  storage_key?: string; // backend key; build transforms as /media/{key}?f=&q=&w=
  alt_text?: string;
  sort_order: number;
  is_primary: boolean;
  width?: number;
  height?: number;
}

export interface ProductOptionValue {
  id: number;
  option_type_id: number;
  option_type_title: string; // stable administrative name
  option_type: string; // e.g. "Color"
  value: string; // e.g. "Red"
}

export interface ProductVariant {
  id: number;
  sku?: string;
  price: number;
  compare_at_price?: number;
  is_active: boolean;
  /** Populated by product-detail responses; omitted by generic variant APIs. */
  available_stock?: number;
  options?: ProductOptionValue[];
  images?: ProductImage[];
}

// Lightweight product list item
export interface ProductListItem {
  id: number;
  title: string;
  code?: string;
  slug?: string;
  image_response: ProductImage | null;
  brand?: string; // brand title, joined
  category?: string; // category title, joined
  tags?: ProductTag[]; // embedded by the list query; omitted when untagged
  is_active: boolean;
  /** Unit weight in kilograms when set (shipping / package quotes). */
  weight?: number;
  min_price: number; // cheapest variant
  max_price: number; // most expensive variant
  active_variant_count: number;
  available_variant_count: number;
  /** Sellable stock summed across active variants. */
  available_stock: number;
  /** Present only when exactly one active variant can be selected safely. */
  purchasable_variant_id?: number;
}

// Full product detail — GET /products/:id
export interface ProductDetail {
  id: number;
  title: string;
  code?: string;
  slug?: string;
  category_id?: number;
  description?: string;
  brand_id?: number;
  country_of_origin?: string;
  abv?: number;
  weight?: number;
  is_active: boolean;
  meta_title?: string;
  meta_description?: string;
  meta_tags?: string[];
  updated_at?: string;
  tags?: ProductTag[];
  images?: ProductImage[];
  variants?: ProductVariant[];
}

// MeiliSearch document shape — flat, search-friendly
export interface MeiliProduct {
  id: number;
  title: string;
  code: string | null;
  slug: string | null;
  description: string | null;
  brand_id: number | null;
  category_id: number | null;
  tags: string[] | null;
  meta_tags: string[] | null;
  min_price: number;
  max_price: number;
  is_active: boolean;
  country_of_origin: string | null;
}
