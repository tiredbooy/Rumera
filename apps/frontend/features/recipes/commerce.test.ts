import { describe, expect, it } from "vitest";

import {
  alternativeSearchHref,
  linkIngredientsToCommerce,
  productDetailHref,
  productShopAnchor,
} from "./commerce";
import type { RecipeIngredient, ShoppableProduct } from "./types";

const product: ShoppableProduct = {
  recipe_product_id: 1,
  product_variant_id: 8,
  product_id: 4,
  product_title: "تکیلای بلانکو",
  product_slug: "casa-blanco",
  price: 4100000,
  is_available: true,
  available_stock: 12,
  sort_order: 0,
  is_primary: true,
};

const ingredient: RecipeIngredient = {
  id: 10,
  product_variant_id: 8,
  ingredient_name: "تکیلا",
  quantity: "50",
  unit: "میلی‌لیتر",
  optional: false,
  notes: null,
  sort_order: 0,
};

describe("recipe commerce projection", () => {
  it("links ingredients to shoppable products by variant id", () => {
    const rows = linkIngredientsToCommerce(
      [
        ingredient,
        {
          ...ingredient,
          id: 11,
          product_variant_id: null,
          ingredient_name: "لیموترش",
        },
      ],
      [product],
    );

    expect(rows[0]?.linked?.product_title).toBe("تکیلای بلانکو");
    expect(rows[0]?.shopAnchor).toBe(productShopAnchor(8));
    expect(rows[1]?.linked).toBeNull();
    expect(rows[1]?.alternativeHref).toContain(
      encodeURIComponent("لیموترش"),
    );
  });

  it("builds safe product and search hrefs", () => {
    expect(productDetailHref(product)).toBe("/products/casa-blanco");
    expect(productDetailHref({ product_slug: "ویژه / A" })).toBe(
      `/products/${encodeURIComponent("ویژه / A")}`,
    );
    expect(productDetailHref({ product_slug: "  " })).toBeNull();
    expect(alternativeSearchHref("  ویسکی  ")).toBe(
      `/search?q=${encodeURIComponent("ویسکی")}`,
    );
  });
});
