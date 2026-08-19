import type { AnchorHTMLAttributes, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { PRODUCT_LIST_PAGE_SIZE } from "@/features/catalog/products/list-routing";
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

vi.mock("@/components/storefront-media", () => ({
  StorefrontMedia: ({ alt }: { alt: string }) => (
    <div role="img" aria-label={alt} />
  ),
}));

vi.mock("./product-card-actions", () => ({
  ProductCardActions: ({ productId }: { productId: number }) => (
    <div data-product-actions={productId} />
  ),
}));

import {
  ProductCard,
  PRODUCT_CARD_GRID_CLASS,
  PRODUCT_CARD_MEDIA_FRAME_CLASS,
} from "./product-card";
import { ProductGridSkeleton } from "./product-grid-skeleton";

const product: ProductListItem = {
  id: 7,
  title: "ویسکی تک‌خمره",
  slug: "single-cask",
  brand: "خانهٔ رومرا",
  image_response: null,
  is_active: true,
  min_price: 4_200_000,
  max_price: 4_200_000,
  active_variant_count: 1,
  available_variant_count: 1,
  available_stock: 6,
  purchasable_variant_id: 3,
};

/**
 * The floors that decide a card's height. A placeholder missing one of them
 * resolves to a taller card and shifts the whole grid.
 */
const HEIGHT_FLOORS = [
  "min-h-6",
  "min-h-[2.75rem]",
  "min-h-7",
  "min-h-14",
] as const;

describe("ProductGridSkeleton", () => {
  it("renders one placeholder per page slot in the real product grid", () => {
    const markup = renderToStaticMarkup(
      <ProductGridSkeleton count={PRODUCT_LIST_PAGE_SIZE} />,
    );

    expect(markup).toContain(PRODUCT_CARD_GRID_CLASS);
    expect(markup.split(PRODUCT_CARD_MEDIA_FRAME_CLASS).length - 1).toBe(
      PRODUCT_LIST_PAGE_SIZE,
    );
    expect(markup).toContain('aria-hidden="true"');
  });

  it("keeps every height floor the real card sets", () => {
    const card = renderToStaticMarkup(<ProductCard product={product} />);
    const skeleton = renderToStaticMarkup(<ProductGridSkeleton count={1} />);

    for (const floor of HEIGHT_FLOORS) {
      expect(card).toContain(floor);
      expect(skeleton).toContain(floor);
    }
    expect(skeleton).toContain(PRODUCT_CARD_MEDIA_FRAME_CLASS);
  });
});
