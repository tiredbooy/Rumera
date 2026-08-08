"use client";

import { useId, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { A11y, FreeMode, Keyboard, Navigation } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import type { Swiper as SwiperInstance } from "swiper";

import { Button } from "@/components/ui/button";
import { ProductCard } from "@/features/catalog/products/components/product-card";
import type { ProductListItem } from "@/features/catalog/products/types";
import { cn } from "@/lib/utils";

import "swiper/css";
import "swiper/css/a11y";
import "swiper/css/free-mode";
import "swiper/css/navigation";

/** Fixed slide width so cards breathe without awkward overflow. */
export const CATALOG_RAIL_SLIDE_CLASS =
  "!h-auto !w-[min(20.5rem,calc(100vw-4rem))] !shrink-0 sm:!w-[21.5rem] lg:!w-[22rem]";

/**
 * Horizontal product rail for the homepage catalogue strip.
 * RTL-aware Swiper track with keyboard, free-mode peek, and nav controls.
 */
export function CatalogProductRail({
  products,
  className,
}: {
  products: ProductListItem[];
  className?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const prevId = `catalog-rail-prev-${uid}`;
  const nextId = `catalog-rail-next-${uid}`;
  const swiperRef = useRef<SwiperInstance | null>(null);
  const reduceMotion = useReducedMotion() ?? false;

  if (products.length === 0) return null;

  return (
    <div className={cn("relative mt-10", className)}>
      <div className="mb-4 flex items-center justify-end gap-2">
        <Button
          type="button"
          id={prevId}
          variant="outline"
          size="icon"
          className="size-10 shrink-0 rounded-full"
          aria-label="محصول قبلی"
        >
          <ChevronRight className="size-4" aria-hidden />
        </Button>
        <Button
          type="button"
          id={nextId}
          variant="outline"
          size="icon"
          className="size-10 shrink-0 rounded-full"
          aria-label="محصول بعدی"
        >
          <ChevronLeft className="size-4" aria-hidden />
        </Button>
      </div>

      <div className="relative -mx-1 overflow-hidden px-1 sm:-mx-2 sm:px-2">
        <Swiper
          modules={[Navigation, A11y, FreeMode, Keyboard]}
          dir="rtl"
          slidesPerView="auto"
          spaceBetween={20}
          speed={reduceMotion ? 0 : 300}
          freeMode={{
            enabled: true,
            sticky: false,
            momentum: !reduceMotion,
            momentumRatio: 0.85,
            momentumVelocityRatio: 0.9,
            minimumVelocity: 0.02,
          }}
          keyboard={{
            enabled: true,
            onlyInViewport: true,
          }}
          navigation={{
            prevEl: `#${prevId}`,
            nextEl: `#${nextId}`,
          }}
          a11y={{
            enabled: true,
            prevSlideMessage: "محصول قبلی",
            nextSlideMessage: "محصول بعدی",
            containerMessage: "ریل محصولات منتخب",
            itemRoleDescriptionMessage: "محصول",
          }}
          watchOverflow
          grabCursor
          resistanceRatio={0.65}
          className="catalog-product-rail !overflow-hidden !pb-1"
          onSwiper={(instance) => {
            swiperRef.current = instance;
          }}
          breakpoints={{
            0: { spaceBetween: 14 },
            640: { spaceBetween: 18 },
            1024: { spaceBetween: 22 },
          }}
        >
          {products.map((product, index) => (
            <SwiperSlide key={product.id} className={CATALOG_RAIL_SLIDE_CLASS}>
              <div className="h-full min-w-0 pe-0.5">
                <ProductCard product={product} priority={index < 2} />
              </div>
            </SwiperSlide>
          ))}
        </Swiper>
      </div>
    </div>
  );
}
