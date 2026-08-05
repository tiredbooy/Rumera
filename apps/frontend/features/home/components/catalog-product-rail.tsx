"use client";

import { useId, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
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

      <Swiper
        modules={[Navigation, A11y, FreeMode, Keyboard]}
        dir="rtl"
        slidesPerView="auto"
        spaceBetween={20}
        freeMode={{
          enabled: true,
          sticky: true,
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
        className="!overflow-visible"
        onSwiper={(instance) => {
          swiperRef.current = instance;
        }}
        breakpoints={{
          0: { spaceBetween: 16 },
          640: { spaceBetween: 20 },
          1024: { spaceBetween: 24 },
        }}
      >
        {products.map((product, index) => (
          <SwiperSlide
            key={product.id}
            className="!h-auto !w-[min(18.5rem,calc(100vw-3.5rem))] sm:!w-[19.5rem]"
          >
            <div className="h-full min-w-0">
              <ProductCard product={product} priority={index < 2} />
            </div>
          </SwiperSlide>
        ))}
      </Swiper>
    </div>
  );
}
