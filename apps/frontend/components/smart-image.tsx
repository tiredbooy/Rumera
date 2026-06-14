"use client"

import * as React from "react"
import Image from "next/image"

import { cn } from "@/lib/utils"

/**
 * SmartImage — `next/image` with a graceful, on-brand fallback.
 *
 * The storefront's sample data and seeded hero slides point at documented
 * placeholder paths (e.g. `/images/hero/slide-1.jpg`) that may not exist yet.
 * Rather than render a broken image, this swaps to a warm "cellar" gradient with
 * an optional monogram/label so every surface still looks intentional. Drop real
 * assets at the documented paths (see `public/images/README.md`) and they light
 * up automatically — no code change needed.
 *
 * Always renders with `fill`, so the parent must be `relative` and sized.
 */
export function SmartImage({
  src,
  alt,
  sizes,
  priority,
  className,
  fallbackClassName,
  monogram = "ر",
  label,
}: {
  src?: string | null
  alt: string
  sizes?: string
  priority?: boolean
  className?: string
  fallbackClassName?: string
  /** Single glyph shown in the fallback (defaults to the Rumera wordmark initial). */
  monogram?: string
  /** Optional caption under the monogram in the fallback. */
  label?: string
}) {
  const [failed, setFailed] = React.useState(false)
  const showFallback = !src || failed

  if (showFallback) {
    return (
      <div
        className={cn(
          "flex h-full w-full flex-col items-center justify-center gap-2",
          "bg-gradient-to-br from-accent/60 via-card to-secondary",
          fallbackClassName
        )}
        role="img"
        aria-label={alt}
      >
        <span
          aria-hidden
          className="cellar-glow flex size-16 items-center justify-center rounded-2xl font-serif text-3xl text-foil ring-1 ring-foreground/10"
        >
          {monogram}
        </span>
        {label ? (
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
        ) : null}
      </div>
    )
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      onError={() => setFailed(true)}
      className={cn("object-cover", className)}
    />
  )
}
