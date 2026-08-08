import type { AnchorHTMLAttributes, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ProductListItem } from "@/features/catalog/products/types";

const mocks = vi.hoisted(() => ({
  reducedMotion: false,
  swiperProps: [] as Array<Record<string, unknown>>,
}));

vi.mock("motion/react", () => ({
  useReducedMotion: () => mocks.reducedMotion,
}));

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
  Swiper: ({ children, className, ...props }: {
    children: ReactNode;
    className?: string;
    [key: string]: unknown;
  }) => {
    mocks.swiperProps.push(props);
    return (
      <div data-swiper-rail className={className}>
        {children}
      </div>
    );
  },
  SwiperSlide: ({
    children,
    className,
  }: {
    children: ReactNode;
    className?: string;
  }) => (
    <div data-swiper-slide className={className}>
      {children}
    </div>
  ),
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

describe("CatalogProductRail", () => {
  beforeEach(() => {
    mocks.reducedMotion = false;
    mocks.swiperProps.length = 0;
  });

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
    // Contained track (not overflow-visible) keeps the rail from looking broken.
    expect(markup).toContain("!overflow-hidden");
    expect(markup).toContain("21.5rem");
    expect(markup).toContain("100vw-4rem");
    expect(markup).toContain("!shrink-0");

    const props = mocks.swiperProps.at(-1);
    expect(props?.dir).toBe("rtl");
    expect(props?.slidesPerView).toBe("auto");
    expect(props?.speed).toBe(300);
    expect(props?.freeMode).toMatchObject({ momentum: true });
    expect(props?.keyboard).toMatchObject({ enabled: true });
    expect(props?.navigation).toBeTruthy();
  });

  it("disables momentum and transition speed for reduced motion", () => {
    mocks.reducedMotion = true;
    renderToStaticMarkup(<CatalogProductRail products={products} />);

    const props = mocks.swiperProps.at(-1);
    expect(props?.speed).toBe(0);
    expect(props?.freeMode).toMatchObject({ momentum: false });
  });

  it("renders nothing when the product list is empty", () => {
    const markup = renderToStaticMarkup(
      <CatalogProductRail products={[]} />,
    );
    expect(markup).toBe("");
  });
});
