import { faNum } from "@/lib/products";

import type { ProductAlert, ProductAlertType } from "./types";

export const ALERT_TYPE_LABELS: Record<ProductAlertType, string> = {
  restock: "اطلاع از موجود شدن",
  price_drop: "اطلاع از کاهش قیمت",
};

/** Honest heading: product title when the API sent one, otherwise the variant id. */
export function productAlertHeading(alert: ProductAlert): string {
  const title = alert.product_title?.trim();
  return title ? title : `تنوع #${faNum(alert.product_variant_id)}`;
}

export function productAlertHref(alert: ProductAlert): string | null {
  const slug = alert.product_slug?.trim();
  return slug ? `/products/${slug}` : null;
}
