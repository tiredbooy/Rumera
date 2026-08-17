import { describe, expect, it } from "vitest";

import { faNum } from "@/lib/products";

import {
  ALERT_TYPE_LABELS,
  productAlertHeading,
  productAlertHref,
} from "./alert-display";
import type { ProductAlert } from "./types";

function alert(partial: Partial<ProductAlert> = {}): ProductAlert {
  return {
    id: 1,
    product_variant_id: 42,
    alert_type: "restock",
    target_price: null,
    notified_at: null,
    created_at: "2026-08-01T00:00:00Z",
    ...partial,
  };
}

describe("productAlertHeading", () => {
  it("does not invent a product title when the API sent only a variant id", () => {
    expect(productAlertHeading(alert())).toBe(`تنوع #${faNum(42)}`);
  });

  it("uses the backend title when enrichment is present", () => {
    expect(
      productAlertHeading(alert({ product_title: "  بطری شیراز  " })),
    ).toBe("بطری شیراز");
  });
});

describe("productAlertHref", () => {
  it("returns no product link without a slug", () => {
    expect(productAlertHref(alert())).toBeNull();
  });

  it("links to the PDP when a slug is present", () => {
    expect(productAlertHref(alert({ product_slug: "shiraz" }))).toBe(
      "/products/shiraz",
    );
  });
});

describe("ALERT_TYPE_LABELS", () => {
  it("covers both backend alert types", () => {
    expect(ALERT_TYPE_LABELS.restock).toBe("اطلاع از موجود شدن");
    expect(ALERT_TYPE_LABELS.price_drop).toBe("اطلاع از کاهش قیمت");
  });
});
