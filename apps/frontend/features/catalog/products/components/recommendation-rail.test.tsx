import type { AnchorHTMLAttributes, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { RecommendationItem } from "@/features/recommendations/types";

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
    <div data-storefront-media>{alt}</div>
  ),
}));

vi.mock("@/features/motion/components/reveal", () => ({
  Reveal: ({
    children,
    className,
  }: {
    children: ReactNode;
    className?: string;
  }) => <div className={className}>{children}</div>,
}));

import {
  RECOMMENDATION_RAIL_ITEM_CLASS,
  RECOMMENDATION_RAIL_TRACK_CLASS,
  RecommendationRail,
} from "./recommendation-rail";

const items: RecommendationItem[] = [
  {
    product_id: 1,
    title: "محصول یک",
    slug: "product-one",
    brand: "رومرا",
    min_price: 120_000,
    max_price: 120_000,
    score: 1,
  },
  {
    product_id: 2,
    title: "محصول دو",
    slug: "product-two",
    min_price: 180_000,
    max_price: 180_000,
    score: 0.8,
  },
];

describe("RecommendationRail", () => {
  it("renders wide RTL scroll-snap cards with a mobile adjacent-card peek", () => {
    const markup = renderToStaticMarkup(
      <RecommendationRail items={items} title="پیشنهادها" />,
    );

    expect(markup).toContain('dir="rtl"');
    expect(markup).toContain('tabindex="0"');
    expect(markup).toContain('aria-label="پیشنهادها، محصولات پیشنهادی"');
    expect(markup).toContain('class="-mx-1 flex snap-x snap-proximity');
    expect(markup).toContain(RECOMMENDATION_RAIL_ITEM_CLASS);
    expect(RECOMMENDATION_RAIL_TRACK_CLASS).toContain("overflow-x-auto");
    expect(RECOMMENDATION_RAIL_TRACK_CLASS).toContain("snap-x");
    expect(RECOMMENDATION_RAIL_ITEM_CLASS).toContain(
      "w-[min(20rem,calc(100vw-4.5rem))]",
    );
    expect(RECOMMENDATION_RAIL_ITEM_CLASS).toContain("sm:w-[21.5rem]");
    expect(RECOMMENDATION_RAIL_ITEM_CLASS).toContain("lg:w-[22rem]");
    expect(RECOMMENDATION_RAIL_ITEM_CLASS).toContain("xl:w-[22.5rem]");
    expect(markup).not.toContain("grid-cols-2");
    expect(markup).toContain('href="/products/product-one"');
    expect(markup).toContain('href="/products/product-two"');
  });

  it("renders nothing for an empty recommendation response", () => {
    expect(
      renderToStaticMarkup(
        <RecommendationRail items={[]} title="پیشنهادها" />,
      ),
    ).toBe("");
  });
});
