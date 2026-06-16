"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * OptimizedImage — renders an image through the backend's on-the-fly transform
 * pipeline (`GET /media/{key}?f&q&w`). Given a storage `imageKey` it emits a
 * `srcset` across a few widths and lazy-loads by default, so the browser pulls
 * the smallest adequate AVIF/WebP for the layout slot.
 *
 * Transform origin comes from `NEXT_PUBLIC_MEDIA_BASE_URL` (e.g. the API host in
 * local dev); when unset it falls back to same-origin (`/media/...`), which is
 * how production serves it behind nginx.
 *
 * Falls back to a branded gradient (never a broken image) when there's no key /
 * src or the request errors — matching `SmartImage`'s behaviour.
 */
const MEDIA_BASE = (process.env.NEXT_PUBLIC_MEDIA_BASE_URL ?? "").replace(/\/$/, "")

export type MediaFormat = "avif" | "webp" | "jpeg" | "png"
export type MediaFit = "cover" | "contain" | "inside"

export function mediaUrl(
  key: string,
  params: { f?: MediaFormat; q?: number; w?: number; h?: number; fit?: MediaFit } = {}
): string {
  const search = new URLSearchParams()
  if (params.f) search.set("f", params.f)
  if (params.q) search.set("q", String(params.q))
  if (params.w) search.set("w", String(params.w))
  if (params.h) search.set("h", String(params.h))
  if (params.fit) search.set("fit", params.fit)
  const qs = search.toString()
  const cleanKey = key.replace(/^\/+/, "")
  return `${MEDIA_BASE}/media/${cleanKey}${qs ? `?${qs}` : ""}`
}

const DEFAULT_WIDTHS = [200, 400, 800]

export function OptimizedImage({
  imageKey,
  src,
  alt,
  width = 400,
  height,
  format = "webp",
  quality = 80,
  widths = DEFAULT_WIDTHS,
  fit,
  sizes,
  priority = false,
  className,
  fallbackClassName,
  monogram = "ر",
}: {
  /** Storage key from the media pipeline (`products/{uuid}.{ext}`). */
  imageKey?: string | null
  /** Legacy / external URL used when no `imageKey` is available. */
  src?: string | null
  alt: string
  width?: number
  height?: number
  format?: MediaFormat
  quality?: number
  widths?: number[]
  fit?: MediaFit
  /** `sizes` attribute for responsive selection from the `srcset`. */
  sizes?: string
  /** Eager-load above-the-fold images; otherwise lazy. */
  priority?: boolean
  className?: string
  fallbackClassName?: string
  monogram?: string
}) {
  const [failed, setFailed] = React.useState(false)

  const resolvedSrc = imageKey
    ? mediaUrl(imageKey, { f: format, q: quality, w: width, h: height, fit })
    : (src ?? null)

  const srcSet = imageKey
    ? widths.map((w) => `${mediaUrl(imageKey, { f: format, q: quality, w, fit })} ${w}w`).join(", ")
    : undefined

  if (!resolvedSrc || failed) {
    return (
      <div
        className={cn(
          "flex h-full w-full flex-col items-center justify-center",
          "bg-gradient-to-br from-accent/60 via-card to-secondary",
          fallbackClassName
        )}
        role="img"
        aria-label={alt}
      >
        <span
          aria-hidden
          className="flex size-12 items-center justify-center rounded-2xl font-serif text-2xl text-foil ring-1 ring-foreground/10"
        >
          {monogram}
        </span>
      </div>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- transform URLs are served by our own /media pipeline, not next/image.
    <img
      src={resolvedSrc}
      srcSet={srcSet}
      sizes={sizes}
      alt={alt}
      width={width}
      height={height}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      onError={() => setFailed(true)}
      className={cn("object-cover", className)}
    />
  )
}
