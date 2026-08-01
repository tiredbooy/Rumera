import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { ProductDetail } from "@/features/catalog/products/types";

vi.mock("@/features/cart/components/add-to-cart-button", () => ({
  AddToCartButton: ({ productVariantId }: { productVariantId: number }) => (
    <button data-cart-variant={productVariantId}>افزودن</button>
  ),
}));

import { ArticleProductCard } from "./article-product-card";

const product: ProductDetail = {
  id: 4,
  title: "محصول مقاله",
  slug: "article-product",
  is_active: true,
  variants: [
    { id: 10, price: 100, is_active: true, available_stock: 0 },
    { id: 11, price: 250, is_active: true, available_stock: 3 },
  ],
};

describe("ArticleProductCard", () => {
  it("shows and adds the same sole purchasable variant", () => {
    const markup = renderToStaticMarkup(<ArticleProductCard product={product} />);
    expect(markup).toContain('data-cart-variant="11"');
    expect(markup).toContain("۲۵۰");
    expect(markup).not.toContain(">۱۰۰<");
  });

  it("routes multiple purchasable variants to option selection", () => {
    const markup = renderToStaticMarkup(
      <ArticleProductCard
        product={{
          ...product,
          variants: [
            ...product.variants!,
            { id: 12, price: 300, is_active: true, available_stock: 2 },
          ],
        }}
      />,
    );
    expect(markup).not.toContain("data-cart-variant");
    expect(markup).toContain("انتخاب گزینه‌ها");
  });
});
