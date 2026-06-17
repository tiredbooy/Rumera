"use client"

import * as React from "react"
import Image from "next/image"

import { cn } from "@/lib/utils"
import type { ProductImage } from "@/lib/catalog/types"

/**
 * ProductGallery — the PDP's image viewer. A large primary frame (`.cellar-glow`
 * lit, contain-fit so bottle silhouettes never crop) with a thumbnail rail that
 * swaps the active image. Thumbnails are keyboard-navigable (Tab + Enter/Space);
 * the active one carries a gold ring. Falls back to `fallback` (the Bottle
 * placeholder) when the product has no photography.
 */
export function ProductGallery({
  images,
  title,
  fallback,
}: {
  images: ProductImage[]
  title: string
  fallback: React.ReactNode
}) {
  const [active, setActive] = React.useState(0)
  const current = images[active]

  return (
    <div className="flex flex-col gap-4">
      <div className="cellar-glow border-hairline shadow-e2 relative flex aspect-square items-center justify-center overflow-hidden rounded-[2rem] ring-1 ring-foreground/10">
        {current ? (
          <Image
            key={current.id}
            src={current.image_url}
            alt={current.alt_text ?? title}
            fill
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="animate-in fade-in-0 zoom-in-95 object-contain p-10 duration-300"
            priority
          />
        ) : (
          fallback
        )}
      </div>

      {images.length > 1 ? (
        <div className="grid grid-cols-5 gap-3">
          {images.map((img, i) => (
            <button
              key={img.id}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`تصویر ${i + 1} از ${title}`}
              aria-current={i === active}
              className={cn(
                "border-hairline relative aspect-square cursor-pointer overflow-hidden rounded-2xl bg-card ring-1 transition-all duration-200",
                i === active
                  ? "ring-2 ring-primary"
                  : "ring-foreground/5 hover:ring-primary/40"
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
  )
}
