import { describe, expect, it } from "vitest";

import { ensureIngredientProducts, strOrNull } from "./sync-shoppable";

describe("ensureIngredientProducts", () => {
  it("appends ingredient-linked variants that are missing from products", () => {
    expect(
      ensureIngredientProducts(
        [
          { product_variant_id: 8, quantity: "50", unit: "میلی‌لیتر" },
          { product_variant_id: null, quantity: "1", unit: "عدد" },
        ],
        [],
      ),
    ).toEqual([
      {
        product_variant_id: 8,
        quantity: "50",
        unit: "میلی‌لیتر",
        is_primary: false,
        sort_order: 0,
      },
    ]);
  });

  it("does not duplicate a variant already listed as shoppable", () => {
    const products = [
      {
        product_variant_id: 8,
        quantity: "1",
        unit: "بطری",
        is_primary: true,
        sort_order: 0,
      },
    ];
    expect(
      ensureIngredientProducts(
        [{ product_variant_id: 8, quantity: "50", unit: "میلی‌لیتر" }],
        products,
      ),
    ).toEqual(products);
  });

  it("drops empty product rows and blank quantities", () => {
    expect(strOrNull("  ")).toBeNull();
    expect(
      ensureIngredientProducts(
        [{ product_variant_id: 3, quantity: "  ", unit: "" }],
        [{ product_variant_id: 0, quantity: null, unit: null }],
      ),
    ).toEqual([
      {
        product_variant_id: 3,
        quantity: null,
        unit: null,
        is_primary: false,
        sort_order: 0,
      },
    ]);
  });
});
