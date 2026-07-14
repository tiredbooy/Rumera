// Admin product write contracts. Product response entities and list queries
// live in features/catalog/products and are imported directly from that owner.

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

export interface ReorderProductImagesInput {
  ids: number[];
}

export interface UpdateProductImageInput {
  alt_text: string | null;
}
