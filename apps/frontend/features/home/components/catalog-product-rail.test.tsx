// @vitest-environment jsdom

import type { AnchorHTMLAttributes, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

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

vi.mock("@/features/catalog/products/components/product-card", () => ({
  ProductCard: ({ product }: { product: ProductListItem }) => (
    <article data-product-card={product.id}>{product.title}</article>
  ),
}));

import {
  CATALOG_RAIL_SLIDE_CLASS,
  CATALOG_RAIL_TRACK_CLASS,
  CatalogProductRail,
} from "./catalog-product-rail";

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
    available_stock: 5,
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
    available_stock: 5,
    purchasable_variant_id: 2,
  },
];

afterEach(cleanup);

describe("CatalogProductRail", () => {
  it("renders a CSS snap track with one card per product", () => {
    const markup = renderToStaticMarkup(
      <CatalogProductRail products={products} />,
    );

    expect(markup).toContain('dir="rtl"');
    expect(markup).toContain('tabindex="0"');
    expect(markup).toContain('aria-label="ریل محصولات منتخب"');
    expect(markup).toContain('data-product-card="1"');
    expect(markup).toContain('data-product-card="2"');
    expect(markup).toContain("محصول یک");
    expect(markup).toContain('aria-label="محصول قبلی"');
    expect(markup).toContain('aria-label="محصول بعدی"');
    expect(markup).not.toMatch(/swiper/i);
    expect(CATALOG_RAIL_TRACK_CLASS).toContain("overflow-x-auto");
    expect(CATALOG_RAIL_TRACK_CLASS).toContain("snap-x");
    expect(CATALOG_RAIL_SLIDE_CLASS).toContain("snap-start");
    expect(CATALOG_RAIL_SLIDE_CLASS).toContain("21.5rem");
    expect(CATALOG_RAIL_SLIDE_CLASS).toContain("100vw-4rem");
    expect(CATALOG_RAIL_SLIDE_CLASS).toContain("shrink-0");
  });

  it("scrolls the snap track from the next and previous controls", () => {
    const scrollBy = vi.fn();
    HTMLElement.prototype.scrollBy = scrollBy;

    render(<CatalogProductRail products={products} />);
    fireEvent.click(screen.getByRole("button", { name: "محصول بعدی" }));
    fireEvent.click(screen.getByRole("button", { name: "محصول قبلی" }));

    expect(scrollBy).toHaveBeenCalledTimes(2);
    expect(scrollBy.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ left: expect.any(Number) }),
    );
  });

  it("renders nothing when the product list is empty", () => {
    const markup = renderToStaticMarkup(
      <CatalogProductRail products={[]} />,
    );
    expect(markup).toBe("");
  });
});
