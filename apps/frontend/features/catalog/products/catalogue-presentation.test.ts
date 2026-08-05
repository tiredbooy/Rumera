import { describe, expect, it } from "vitest";

import {
  catalogueAvailability,
  cataloguePriceDisplay,
  isQuickPurchasable,
  productPublicHref,
} from "./catalogue-presentation";

describe("catalogue presentation", () => {
  it("never builds product links without a real slug", () => {
    expect(productPublicHref({ slug: "reserve" })).toBe("/products/reserve");
    expect(productPublicHref({ slug: "ویژه / A?" })).toBe(
      `/products/${encodeURIComponent("ویژه / A?")}`,
    );
    expect(productPublicHref({ slug: "  " })).toBeNull();
    expect(productPublicHref({ slug: undefined })).toBeNull();
    expect(productPublicHref({ slug: null })).toBeNull();
  });

  it("separates ready, out-of-stock, and unconfigured availability", () => {
    expect(
      catalogueAvailability({
        active_variant_count: 2,
        available_variant_count: 1,
      }),
    ).toEqual({ kind: "ready", label: "آمادهٔ سفارش" });
    expect(
      catalogueAvailability({
        active_variant_count: 1,
        available_variant_count: 0,
      }),
    ).toEqual({ kind: "out_of_stock", label: "ناموجود" });
    expect(
      catalogueAvailability({
        active_variant_count: 0,
        available_variant_count: 0,
      }),
    ).toEqual({ kind: "unconfigured", label: "در حال تأمین" });
  });

  it("shows real zero prices when variants exist and withholds price when they do not", () => {
    expect(
      cataloguePriceDisplay({
        min_price: 0,
        max_price: 0,
        active_variant_count: 1,
      }),
    ).toEqual({ kind: "single", amount: 0, ranged: false });

    expect(
      cataloguePriceDisplay({
        min_price: 10,
        max_price: 40,
        active_variant_count: 2,
      }),
    ).toEqual({ kind: "range", amount: 10, max: 40, ranged: true });

    expect(
      cataloguePriceDisplay({
        min_price: 0,
        max_price: 0,
        active_variant_count: 0,
      }),
    ).toEqual({ kind: "unconfigured" });
  });

  it("only marks a product quick-purchasable for a positive variant id", () => {
    expect(isQuickPurchasable({ purchasable_variant_id: 9 })).toBe(true);
    expect(isQuickPurchasable({ purchasable_variant_id: 0 })).toBe(false);
    expect(isQuickPurchasable({ purchasable_variant_id: undefined })).toBe(
      false,
    );
  });
});
