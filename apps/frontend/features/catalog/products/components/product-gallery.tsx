"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { StorefrontMedia } from "@/components/storefront-media";
import { cn } from "@/lib/utils";
import { faNum } from "@/lib/products";
import type { ProductImage } from "@/features/catalog/products/types";

/**
 * ProductGallery — clean PDP media viewer (no glow backdrop).
 * Desktop: main frame + thumbnail radiogroup.
 * Mobile: swipeable main frame (touch), compact horizontal thumbs, app-like chrome.
 */
export function ProductGallery({
  images,
  title,
  fallback,
}: {
  images: ProductImage[];
  title: string;
  fallback: React.ReactNode;
}) {
  const [active, setActive] = React.useState(0);
  const thumbRefs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const touchStartX = React.useRef<number | null>(null);
  const count = images.length;
  const safeActive = count > 0 ? Math.min(active, count - 1) : 0;
  const current = images[safeActive];

  const go = React.useCallback(
    (next: number, focus = false) => {
      if (count === 0) return;
      const clamped = (next + count) % count;
      setActive(clamped);
      if (focus) thumbRefs.current[clamped]?.focus();
    },
    [count],
  );

  // RTL-aware: ArrowRight moves to the *previous* (visually leading) image.
  function onThumbKey(e: React.KeyboardEvent) {
    if (count < 2) return;
    switch (e.key) {
      case "ArrowLeft":
        e.preventDefault();
        go(safeActive + 1, true);
        break;
      case "ArrowRight":
        e.preventDefault();
        go(safeActive - 1, true);
        break;
      case "Home":
        e.preventDefault();
        go(0, true);
        break;
      case "End":
        e.preventDefault();
        go(count - 1, true);
        break;
    }
  }

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.changedTouches[0]?.clientX ?? null;
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (count < 2 || touchStartX.current == null) return;
    const endX = e.changedTouches[0]?.clientX;
    if (endX == null) return;
    const delta = endX - touchStartX.current;
    touchStartX.current = null;
    // RTL: swipe finger to the left (negative delta) → next image in sequence.
    if (Math.abs(delta) < 40) return;
    if (delta < 0) go(safeActive + 1);
    else go(safeActive - 1);
  }

  return (
    <div className="flex flex-col gap-3 sm:gap-4">
      <div
        className={cn(
          "border-hairline shadow-e1 group/frame relative flex aspect-square items-center justify-center overflow-hidden rounded-3xl bg-card outline-none ring-1 ring-foreground/8 sm:rounded-[1.75rem]",
          "focus-visible:ring-3 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        )}
        role={count > 1 ? "group" : undefined}
        aria-roledescription={count > 1 ? "گالری تصاویر" : undefined}
        aria-label={count > 1 ? title : undefined}
        tabIndex={count > 1 ? 0 : -1}
        onKeyDown={(e) => {
          if (count < 2) return;
          if (e.key === "ArrowLeft") {
            e.preventDefault();
            go(safeActive + 1);
          } else if (e.key === "ArrowRight") {
            e.preventDefault();
            go(safeActive - 1);
          }
        }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {current ? (
          <div
            key={current.id}
            className="animate-in fade-in-0 absolute inset-0 p-6 duration-300 ease-out motion-reduce:animate-none sm:p-8 md:p-10"
          >
            <StorefrontMedia
              slot="product-gallery"
              storageKey={current.storage_key}
              src={current.image_url}
              alt={current.alt_text?.trim() || title}
              intrinsicWidth={current.width}
              intrinsicHeight={current.height}
              priority
              className="object-contain"
            />
          </div>
        ) : (
          fallback
        )}

        {count > 1 ? (
          <>
            <button
              type="button"
              onClick={() => go(safeActive + 1)}
              aria-label="تصویر بعدی"
              className="absolute end-3 top-1/2 z-10 flex size-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-border/60 bg-background/90 text-foreground opacity-90 shadow-e1 outline-none backdrop-blur-sm transition-[opacity,transform,background-color] duration-200 hover:scale-105 hover:bg-background hover:opacity-100 focus-visible:ring-3 focus-visible:ring-primary/60 motion-reduce:transition-none sm:end-4"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              onClick={() => go(safeActive - 1)}
              aria-label="تصویر قبلی"
              className="absolute start-3 top-1/2 z-10 flex size-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-border/60 bg-background/90 text-foreground opacity-90 shadow-e1 outline-none backdrop-blur-sm transition-[opacity,transform,background-color] duration-200 hover:scale-105 hover:bg-background hover:opacity-100 focus-visible:ring-3 focus-visible:ring-primary/60 motion-reduce:transition-none sm:start-4"
            >
              <ChevronRight className="size-5" />
            </button>
            <span
              aria-live="polite"
              className="absolute bottom-3 start-1/2 z-10 -translate-x-1/2 rounded-full border border-border/50 bg-background/90 px-3 py-1 text-xs font-medium tabular-nums text-muted-foreground shadow-e1 backdrop-blur-sm sm:bottom-4"
            >
              {faNum(safeActive + 1)} / {faNum(count)}
            </span>
            {/* Mobile page dots */}
            <div
              className="absolute inset-x-0 bottom-12 flex justify-center gap-1.5 sm:hidden"
              aria-hidden
            >
              {images.map((img, i) => (
                <span
                  key={img.id}
                  className={cn(
                    "size-1.5 rounded-full transition-colors",
                    i === safeActive ? "bg-primary" : "bg-foreground/20",
                  )}
                />
              ))}
            </div>
          </>
        ) : null}
      </div>

      {count > 1 ? (
        <div
          role="radiogroup"
          aria-label="تصاویر محصول"
          className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] sm:grid sm:grid-cols-5 sm:gap-3 sm:overflow-visible sm:px-0 sm:pb-0 [&::-webkit-scrollbar]:hidden"
          onKeyDown={onThumbKey}
        >
          {images.map((img, i) => (
            <button
              key={img.id}
              ref={(el) => {
                thumbRefs.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={i === safeActive}
              tabIndex={i === safeActive ? 0 : -1}
              onClick={() => setActive(i)}
              aria-label={`تصویر ${faNum(i + 1)} از ${title}`}
              className={cn(
                "border-hairline relative aspect-square w-[4.5rem] shrink-0 cursor-pointer overflow-hidden rounded-2xl bg-card ring-1 transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none sm:w-auto",
                i === safeActive
                  ? "ring-2 ring-primary"
                  : "ring-foreground/5 hover:ring-primary/40",
              )}
            >
              <div className="absolute inset-0 p-2 sm:p-2.5">
                <StorefrontMedia
                  slot="product-thumb"
                  storageKey={img.storage_key}
                  src={img.image_url}
                  alt=""
                  className="object-contain"
                />
              </div>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
