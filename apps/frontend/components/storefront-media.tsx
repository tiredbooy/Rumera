"use client";

import * as React from "react";

import { OptimizedImage } from "@/components/optimized-image";
import {
  mediaPolicyFor,
  resolveStorefrontMediaSource,
  type StorefrontMediaSlot,
} from "@/lib/media/storefront-policy";
import { cn } from "@/lib/utils";

/**
 * StorefrontMedia — the single entry point for storefront imagery.
 *
 * Applies the named slot policy (widths, sizes, quality, domain monogram) and
 * prefers the transform pipeline via storage keys when available, including
 * keys derived from canonical `/media/{key}` URLs. Falls back to a branded
 * monogram surface when media is missing or fails.
 */
export function StorefrontMedia({
  slot,
  storageKey,
  src,
  alt,
  monogram,
  label,
  priority,
  className,
  fallbackClassName,
  intrinsicWidth,
  intrinsicHeight,
}: {
  slot: StorefrontMediaSlot;
  storageKey?: string | null;
  src?: string | null;
  alt: string;
  /** Overrides the slot monogram (e.g. product title initial). */
  monogram?: string;
  label?: string;
  priority?: boolean;
  className?: string;
  fallbackClassName?: string;
  /** Optional stored pixel dimensions for aspect-aware transforms. */
  intrinsicWidth?: number | null;
  intrinsicHeight?: number | null;
}) {
  const policy = mediaPolicyFor(slot);
  const { imageKey, src: resolvedSrc } = resolveStorefrontMediaSource({
    storageKey,
    src,
  });

  // When metadata provides an aspect ratio, pin the transform height so the
  // pipeline does not invent a square crop for non-square originals.
  let height = policy.height;
  if (
    !height &&
    intrinsicWidth &&
    intrinsicHeight &&
    intrinsicWidth > 0 &&
    intrinsicHeight > 0
  ) {
    height = Math.round((policy.width * intrinsicHeight) / intrinsicWidth);
  }

  return (
    <OptimizedImage
      imageKey={imageKey}
      src={resolvedSrc}
      alt={alt}
      width={policy.width}
      height={height}
      format={policy.format}
      quality={policy.quality}
      widths={policy.widths}
      fit={policy.fit}
      sizes={policy.sizes}
      priority={priority ?? policy.priority}
      monogram={monogram ?? policy.monogram}
      className={cn("h-full w-full", className)}
      fallbackClassName={cn(policy.fallbackClassName, fallbackClassName)}
    />
  );
}
