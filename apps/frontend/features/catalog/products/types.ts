// features/catalog/products/types.ts
//
// Mirrors backend/models/product_response.go exactly.
// Do not hand-edit fields without checking the Go source first —
// drift here is what caused the alt_text null/undefined bug.

export interface ImageResponse {
  id: number;
  image_url: string; // canonical serving URL (/media/{key} for uploads)
  storage_key?: string | null; // backend key; build transforms as /media/{key}?f=&q=&w=
  alt_text?: string | null;
  sort_order: number;
  is_primary: boolean;
  width?: number | null;
  height?: number | null;
}

export interface OptionValueResponse {
  id: number;
  option_type: string; // e.g. "Color"
  value: string; // e.g. "Red"
}

export interface VariantResponse {
  id: number;
  sku?: string | null;
  price: number;
  compare_at_price?: number | null;
  is_active: boolean;
  options?: OptionValueResponse[];
  images?: ImageResponse[];
}

export interface TagResponse {
  id: number;
  title: string;
}

// Lightweight product list item
export interface ProductListItem {
  id: number;
  title: string;
  code?: string | null;
  slug?: string | null;
  image_response: ImageResponse | null;
  brand?: string | null; // brand title, joined
  category?: string | null; // category title, joined
  is_active: boolean;
  min_price: number; // cheapest variant
  max_price: number; // most expensive variant
}

// Full product detail — GET /products/:id
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

// MeiliSearch document shape — flat, search-friendly
export interface MeiliProduct {
  id: number;
  title: string;
  code: string | null;
  slug: string | null;
  description: string | null;
  brand_id: number | null;
  category_id: number | null;
  tags: string[];
  meta_tags: string[];
  min_price: number;
  max_price: number;
  is_active: boolean;
  country_of_origin: string | null;
}
