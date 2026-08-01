import type { AnchorHTMLAttributes, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { ProductListItem } from "@/features/catalog/products/types";
import { formatPrice } from "@/lib/products";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
    children: ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/optimized-image", () => ({
  OptimizedImage: ({ alt, className }: { alt: string; className?: string }) => (
    <div role="img" aria-label={alt} className={className} />
  ),
}));

vi.mock("./product-card-actions", () => ({
  ProductCardActions: ({ productId }: { productId: number }) => (
    <div data-product-actions={productId} />
  ),
}));

import { ProductCard, PRODUCT_CARD_GRID_CLASS } from "./product-card";

const product: ProductListItem = {
  id: 42,
  title: "بطری رزرو ویژه",
  slug: "reserve-bottle",
  brand: "خانهٔ رومرا",
  category: "رزرو",
  tags: [
    { id: 1, title: "هدیهٔ بسیار ویژهٔ رومرا" },
    { id: 2, title: "کمیاب و کلکسیونی" },
    { id: 3, title: "محدود" },
  ],
  image_response: null,
  is_active: true,
  min_price: 987_654_321_000,
  max_price: 987_654_321_000,
  active_variant_count: 1,
  available_variant_count: 1,
  purchasable_variant_id: 9,
};

describe("ProductCard", () => {
  it("keeps the complete price visible and presents real tags in the semantic card", () => {
    const markup = renderToStaticMarkup(<ProductCard product={product} />);

    expect(markup).toContain("<article");
    expect(markup).toContain('data-slot="card"');
    expect(markup).toContain("aspect-square");
    expect(markup).toContain("whitespace-nowrap");
    expect(markup).toContain(formatPrice(product.min_price));
    expect(markup).toContain("رزرو");
    expect(markup).toContain("خانهٔ رومرا");
    expect(markup).toContain("آمادهٔ سفارش");
    expect(markup).toContain('aria-label="برچسب‌های محصول"');
    expect(markup).toContain("هدیهٔ بسیار ویژهٔ رومرا");
    expect(markup).toContain("کمیاب و کلکسیونی");
    expect(markup).toContain("min-w-0");
    expect(markup).toContain("shrink");
    expect(markup).not.toContain("محدود");
    expect(markup).toContain("+۱");
    expect(markup).toContain('href="/products/reserve-bottle"');
  });

  it("renders truthful unavailable and missing-public-page states", () => {
    const markup = renderToStaticMarkup(
      <ProductCard
        product={{
          ...product,
          slug: undefined,
          tags: undefined,
          min_price: 0,
          max_price: 0,
          active_variant_count: 0,
          available_variant_count: 0,
          purchasable_variant_id: undefined,
        }}
      />,
    );

    expect(markup).toContain("در حال تأمین");
    expect(markup).toContain("بدون صفحهٔ عمومی");
    expect(markup).not.toContain('href="/products/');
  });

  it("distinguishes an active out-of-stock product from an unconfigured product", () => {
    const markup = renderToStaticMarkup(
      <ProductCard
        product={{
          ...product,
          min_price: 0,
          max_price: 0,
          active_variant_count: 1,
          available_variant_count: 0,
          purchasable_variant_id: undefined,
        }}
      />,
    );

    expect(markup).toContain("ناموجود");
    expect(markup).toContain("قیمت ثبت نشده");
    expect(markup).not.toContain("در حال تأمین");
  });

  it("uses a mobile-safe auto-fill grid with a usable card minimum", () => {
    expect(PRODUCT_CARD_GRID_CLASS).toContain("grid-cols-1");
    expect(PRODUCT_CARD_GRID_CLASS).toContain("auto-fill");
    expect(PRODUCT_CARD_GRID_CLASS).toContain("minmax(21rem,1fr)");
    expect(PRODUCT_CARD_GRID_CLASS).not.toContain("grid-cols-4");
  });
});
