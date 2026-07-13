import type { ProductOptionValue } from "@/features/catalog/products/types";

export interface CartItem {
  id: number;
  product_id: number;
  product_title: string;
  variant_id: number;
  sku?: string;
  current_price: number;
  price_changed: boolean;
  quantity: number;
  line_total: number;
  image_url?: string;
  options?: ProductOptionValue[];
}

export interface CartSummary {
  total_items: number;
  unique_items: number;
  subtotal: number;
  discount_total: number;
}

export interface Cart {
  id: number;
  items: CartItem[];
  summary: CartSummary;
}

export interface AddCartItemInput {
  product_variant_id: number;
  quantity: number;
}

export interface BulkAddCartInput {
  items: AddCartItemInput[];
}

export interface UpdateCartItemInput {
  quantity: number;
}

export type SkippedCartItemReason =
  | "invalid"
  | "not_found"
  | "unavailable";

export interface SkippedCartItem {
  product_variant_id: number;
  reason: SkippedCartItemReason;
}

export interface BulkAddCartResult {
  cart: Cart;
  added: number;
  skipped: SkippedCartItem[];
}
