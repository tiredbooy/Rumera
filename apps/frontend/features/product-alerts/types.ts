export type ProductAlertType = "restock" | "price_drop";

/**
 * Customer product-alert subscription returned by create and list endpoints.
 * GET /alerts is variant-id only today; title/slug/price arrive only if the
 * backend later enriches the payload (PR-053b). Never invent those fields.
 */
export interface ProductAlert {
  id: number;
  product_variant_id: number;
  alert_type: ProductAlertType;
  target_price: number | null;
  notified_at: string | null;
  created_at: string;
  product_title?: string | null;
  product_slug?: string | null;
  current_price?: number | null;
}

export interface CreateProductAlertInput {
  product_variant_id: number;
  alert_type: ProductAlertType;
  target_price?: number | null;
}
