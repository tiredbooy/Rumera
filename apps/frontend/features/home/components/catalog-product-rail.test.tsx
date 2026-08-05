import type { AnchorHTMLAttributes, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { ProductListItem } from "@/features/catalog/products/types";

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

vi.mock("swiper/react", () => ({
  Swiper: ({
    children,
    className,
  }: {
    children: ReactNode;
    className?: string;
  }) => (
    <div data-swiper-rail className={className}>
      {children}
    </div>
  ),
  SwiperSlide: ({
    children,
    className,
  }: {
    children: ReactNode;
    className?: string;
  }) => <div data-swiper-slide className={className}>{children}</div>,
}));

vi.mock("swiper/modules", () => ({
  A11y: {},
  FreeMode: {},
  Keyboard: {},
  Navigation: {},
}));

vi.mock("swiper/css", () => ({}));
vi.mock("swiper/css/a11y", () => ({}));
vi.mock("swiper/css/free-mode", () => ({}));
vi.mock("swiper/css/navigation", () => ({}));

vi.mock("@/features/catalog/products/components/product-card", () => ({
  ProductCard: ({ product }: { product: ProductListItem }) => (
    <article data-product-card={product.id}>{product.title}</article>
  ),
}));

import { CatalogProductRail } from "./catalog-product-rail";

const products: ProductListItem[] = [
  {
    id: 1,
    title: "محصول یک",
    slug: "p-1",
    image_response: null,
    is_active: true,
    min_price: 1000,
    max_price: 1000,
    active_variant_count: 1,
    available_variant_count: 1,
    purchasable_variant_id: 1,
  },
  {
    id: 2,
    title: "محصول دو",
    slug: "p-2",
    image_response: null,
    is_active: true,
    min_price: 2000,
    max_price: 2000,
    active_variant_count: 1,
    available_variant_count: 1,
    purchasable_variant_id: 2,
  },
];

describe("CatalogProductRail", () => {
  it("renders a horizontal swiper track with one slide per product", () => {
    const markup = renderToStaticMarkup(
      <CatalogProductRail products={products} />,
    );

    expect(markup).toContain("data-swiper-rail");
    expect(markup).toContain("data-swiper-slide");
    expect(markup).toContain('data-product-card="1"');
    expect(markup).toContain('data-product-card="2"');
    expect(markup).toContain("محصول یک");
    expect(markup).toContain('aria-label="محصول قبلی"');
    expect(markup).toContain('aria-label="محصول بعدی"');
  });

  it("renders nothing when the product list is empty", () => {
    const markup = renderToStaticMarkup(
      <CatalogProductRail products={[]} />,
    );
    expect(markup).toBe("");
  });
});
