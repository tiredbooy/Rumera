import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { ShoppableProduct } from "@/features/recipes/types";

vi.mock("@/features/cart/components/add-to-cart-button", () => ({
  AddToCartButton: ({
    productVariantId,
    ariaLabel,
  }: {
    productVariantId: number;
    ariaLabel: string;
  }) => (
    <button data-cart-variant={productVariantId} aria-label={ariaLabel}>
      افزودن
    </button>
  ),
}));

import { ShoppableProductCard } from "./shoppable-product-card";

const product: ShoppableProduct = {
  recipe_product_id: 1,
  product_variant_id: 8,
  product_id: 4,
  product_title: "محصول دستور",
  product_slug: "محصول / ویژه",
  price: 100,
  is_available: true,
  available_stock: 3,
  quantity: "1.250",
  unit: "پیمانه",
  sort_order: 0,
  is_primary: false,
  role: "base",
};

describe("ShoppableProductCard", () => {
  it("localizes backend roles, quantities, links, and cart labels", () => {
    const markup = renderToStaticMarkup(
      <ShoppableProductCard product={product} />,
    );
    expect(markup).toContain("پایهٔ اصلی");
    expect(markup).not.toContain(">base<");
    expect(markup).toContain("۱٫۲۵ پیمانه");
    expect(markup).toContain(
      `href="/products/${encodeURIComponent(product.product_slug!)}"`,
    );
    expect(markup).toContain('aria-label="افزودن محصول دستور به سبد خرید"');
  });
});
