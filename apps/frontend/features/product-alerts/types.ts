export type ProductAlertType = "restock" | "price_drop";

/** Customer product-alert subscription returned by create and list endpoints. */
export interface ProductAlert {
  id: number;
  product_variant_id: number;
  alert_type: ProductAlertType;
  target_price: number | null;
  notified_at: string | null;
  created_at: string;
}

export interface CreateProductAlertInput {
  product_variant_id: number;
  alert_type: ProductAlertType;
  target_price?: number | null;
}
