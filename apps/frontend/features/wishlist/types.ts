import type { ProductOptionValue } from "@/features/catalog/products/types";

export interface WishlistItem {
  id: number;
  product_id: number;
  product_slug?: string;
  product_title: string;
  variant_id: number;
  sku?: string;
  price: number;
  compare_at_price?: number;
  image_url?: string;
  options?: ProductOptionValue[];
  is_in_stock: boolean;
  added_at: string;
}

export interface Wishlist {
  id: number;
  items: WishlistItem[];
  total: number;
}

export interface AddWishlistItemInput {
  product_variant_id: number;
}

export interface AddWishlistItemResult {
  wishlist_id: number;
}

export interface WishlistMembership {
  has_item: boolean;
}
