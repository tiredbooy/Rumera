// Admin product write contracts. Product response entities and list queries
// live in features/catalog/products and are imported directly from that owner.

import type {
  ProductDetail,
  ProductImage,
  ProductVariant,
} from "@/features/catalog/products/types";

export interface AdminProductVariant extends ProductVariant {
  options: NonNullable<ProductVariant["options"]>;
  images: ProductImage[];
}

export interface AdminProductDetail extends ProductDetail {
  updated_at: string;
  images: ProductImage[];
  variants: AdminProductVariant[];
}

export interface SaveProductVariantInput {
  id?: number;
  sku: string | null;
  price: number;
  compare_at_price: number | null;
  is_active: boolean;
  option_value_ids: number[];
}

export interface SaveProductImageInput {
  id?: number;
  storage_key?: string;
  image_url?: string;
  alt_text: string | null;
  is_primary: boolean;
}

export interface SaveProductAggregateInput {
  operation_id: string;
  expected_updated_at?: string;
  title: string;
  code: string | null;
  slug: string | null;
  category_id: number | null;
  description: string | null;
  brand_id: number | null;
  country_of_origin: string | null;
  abv: number | null;
  weight: number | null;
  is_active: boolean;
  meta_title: string | null;
  meta_description: string | null;
  meta_tags: string[];
  tag_ids: number[];
  variants: SaveProductVariantInput[];
  images: SaveProductImageInput[];
}

export interface CreateProductVariantInput {
  sku?: string | null;
  price: number;
  compare_at_price?: number | null;
  option_value_ids?: number[] | null;
}

export interface UpdateProductVariantInput {
  sku?: string | null;
  price?: number | null;
  compare_at_price?: number | null;
  is_active?: boolean | null;
}

export interface CreateProductInput {
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
  meta_tags?: string[] | null;
  tag_ids?: number[] | null;
  variants?: CreateProductVariantInput[] | null;
}

export interface UpdateProductInput {
  title?: string | null;
  code?: string | null;
  slug?: string | null;
  category_id?: number | null;
  description?: string | null;
  brand_id?: number | null;
  country_of_origin?: string | null;
  abv?: number | null;
  weight?: number | null;
  is_active?: boolean | null;
  meta_title?: string | null;
  meta_description?: string | null;
  meta_tags?: string[] | null;
  tag_ids?: number[] | null;
}

export interface ProductTagIdsInput {
  tag_ids: number[];
}

export interface ProductVariantOptionIdsInput {
  option_value_ids: number[];
}

export interface ProductOptionType {
  id: number;
  title: string;
  display_name: string;
  created_at: string;
  updated_at: string;
}

export interface ProductOptionValueDefinition {
  id: number;
  option_type_id: number;
  value: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ProductOptionGroup extends ProductOptionType {
  values: ProductOptionValueDefinition[];
}

export interface ReorderProductImagesInput {
  ids: number[];
}

export interface UpdateProductImageInput {
  alt_text: string | null;
}
