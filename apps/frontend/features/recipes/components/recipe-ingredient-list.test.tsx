import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { CommerceIngredient } from "@/features/recipes/commerce";
import { productShopAnchor } from "@/features/recipes/commerce";

import { RecipeIngredientList } from "./recipe-ingredient-list";

const linked: CommerceIngredient = {
  id: 1,
  product_variant_id: 8,
  ingredient_name: "تکیلا",
  quantity: "50",
  unit: "میلی‌لیتر",
  optional: false,
  notes: null,
  sort_order: 0,
  linked: {
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
  },
  shopAnchor: productShopAnchor(8),
  alternativeHref: "/search?q=%D8%AA%DA%A9%DB%8C%D9%84%D8%A7",
};

describe("RecipeIngredientList", () => {
  it("renders a linked in-stock ingredient as shoppable", () => {
    const html = renderToStaticMarkup(
      <RecipeIngredientList ingredients={[linked]} servings={1} />,
    );

    expect(html).toContain('data-linked="true"');
    expect(html).toContain("قابل خرید");
    expect(html).toContain("تکیلای بلانکو");
    expect(html).toContain("خرید این ماده");
    expect(html).toContain(`#${productShopAnchor(8)}`);
  });
});
