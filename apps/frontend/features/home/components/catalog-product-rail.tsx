"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ProductCard } from "@/features/catalog/products/components/product-card";
import type { ProductListItem } from "@/features/catalog/products/types";
import { cn } from "@/lib/utils";

export const CATALOG_RAIL_TRACK_CLASS =
  "-mx-1 flex snap-x snap-proximity gap-4 overflow-x-auto overscroll-x-contain scroll-px-1 rounded-3xl px-1 pb-3 sm:gap-5 [scrollbar-width:none] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-4 focus-visible:ring-offset-background [&::-webkit-scrollbar]:hidden";

/** Fixed card width so the next product peeks, matching the recommendation rail. */
export const CATALOG_RAIL_SLIDE_CLASS =
  "h-auto w-[min(20.5rem,calc(100vw-4rem))] shrink-0 snap-start sm:w-[21.5rem] lg:w-[22rem]";

function prefersReducedMotion() {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function scrollRail(track: HTMLElement, direction: "next" | "prev") {
  const amount = Math.round(Math.min(track.clientWidth * 0.85, 360));
  const rtl = getComputedStyle(track).direction === "rtl";
  const towardEnd = direction === "next";
  const left = (rtl ? -1 : 1) * (towardEnd ? amount : -amount);
  track.scrollBy({
    left,
    behavior: prefersReducedMotion() ? "auto" : "smooth",
  });
}

/**
 * Horizontal product rail for the homepage catalogue strip.
 * CSS scroll-snap track with keyboard, peek, and optional nav controls.
 */
export function CatalogProductRail({
  products,
  className,
}: {
  products: ProductListItem[];
  className?: string;
}) {
  const trackRef = useRef<HTMLUListElement>(null);

  if (products.length === 0) return null;

  return (
    <div className={cn("relative mt-10", className)}>
      <div className="mb-4 flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-10 shrink-0 rounded-full"
          aria-label="محصول قبلی"
          onClick={() => {
            if (trackRef.current) scrollRail(trackRef.current, "prev");
          }}
        >
          <ChevronRight className="size-4" aria-hidden />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-10 shrink-0 rounded-full"
          aria-label="محصول بعدی"
          onClick={() => {
            if (trackRef.current) scrollRail(trackRef.current, "next");
          }}
        >
          <ChevronLeft className="size-4" aria-hidden />
        </Button>
      </div>

      <ul
        ref={trackRef}
        dir="rtl"
        tabIndex={0}
        aria-label="ریل محصولات منتخب"
        className={CATALOG_RAIL_TRACK_CLASS}
      >
        {products.map((product, index) => (
          <li key={product.id} className={CATALOG_RAIL_SLIDE_CLASS}>
            <div className="h-full min-w-0 pe-0.5">
              <ProductCard product={product} priority={index < 2} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
