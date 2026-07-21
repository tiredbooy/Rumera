"use client";

import * as React from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { faNum } from "@/lib/products";
import type { ProductImage } from "@/features/catalog/products/types";

/**
 * ProductGallery — the PDP's image viewer. A large primary frame (`.cellar-glow`
 * lit, contain-fit so bottle silhouettes never crop) with a thumbnail rail that
 * swaps the active image. Fully keyboard-driven: the thumbnail strip is a roving
 * `radiogroup` (← → / Home / End move + select, RTL-aware); the main frame
 * advances with ← →; the active thumb carries a gold ring. An image counter sits
 * over the frame. Falls back to `fallback` (the Bottle placeholder) when the
 * product has no photography.
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

  return (
    <div className="flex flex-col gap-4">
      <div
        className="cellar-glow border-hairline shadow-e2 group/frame relative flex aspect-square items-center justify-center overflow-hidden rounded-[2rem] outline-none ring-1 ring-foreground/10 focus-visible:ring-3 focus-visible:ring-primary/60 focus-visible:ring-offset-2"
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
      >
        {current ? (
          <Image
            key={current.id}
            src={current.image_url}
            alt={current.alt_text?.trim() || title}
            fill
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="animate-in fade-in-0 zoom-in-95 object-contain p-10 duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
            priority
          />
        ) : (
          fallback
        )}

        {/* Prev / next + counter — only when there's more than one image */}
        {count > 1 ? (
          <>
            <button
              type="button"
              onClick={() => go(safeActive + 1)}
              aria-label="تصویر بعدی"
              className="absolute end-4 top-1/2 flex size-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-background/80 text-foreground opacity-90 shadow-e1 outline-none ring-1 ring-foreground/10 backdrop-blur-sm transition-[opacity,transform,background-color] duration-200 hover:scale-105 hover:bg-background hover:opacity-100 focus-visible:ring-3 focus-visible:ring-primary/60 motion-reduce:transition-none"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              onClick={() => go(safeActive - 1)}
              aria-label="تصویر قبلی"
              className="absolute start-4 top-1/2 flex size-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-background/80 text-foreground opacity-90 shadow-e1 outline-none ring-1 ring-foreground/10 backdrop-blur-sm transition-[opacity,transform,background-color] duration-200 hover:scale-105 hover:bg-background hover:opacity-100 focus-visible:ring-3 focus-visible:ring-primary/60 motion-reduce:transition-none"
            >
              <ChevronRight className="size-5" />
            </button>
            <span
              aria-live="polite"
              className="absolute bottom-4 start-1/2 -translate-x-1/2 rounded-full bg-background/70 px-2.5 py-0.5 text-xs font-medium tabular-nums text-muted-foreground backdrop-blur-sm"
            >
              {faNum(safeActive + 1)} / {faNum(count)}
            </span>
          </>
        ) : null}
      </div>

      {count > 1 ? (
        <div
          role="radiogroup"
          aria-label="تصاویر محصول"
          className="grid grid-cols-5 gap-3"
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
                "border-hairline relative aspect-square cursor-pointer overflow-hidden rounded-2xl bg-card ring-1 transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none",
                i === safeActive
                  ? "ring-2 ring-primary"
                  : "ring-foreground/5 hover:ring-primary/40",
              )}
            >
              <Image
                src={img.image_url}
                alt=""
                fill
                sizes="20vw"
                className="object-contain p-2.5"
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
