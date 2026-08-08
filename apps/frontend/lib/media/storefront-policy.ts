/**
 * Canonical storefront media policy.
 *
 * Every storefront surface that shows product/content imagery should pick a
 * named slot from here so widths, sizes, quality, and domain monograms stay
 * consistent. Slot values are deliberate: cards use denser width ladders;
 * heroes bias toward larger, priority-capable sources.
 */

import { normalizeMediaStorageKey } from "@/lib/media/resolve-media-url";

export type StorefrontMediaSlot =
  | "product-card"
  | "product-gallery"
  | "product-thumb"
  | "recommendation"
  | "wishlist"
  | "brand-tile"
  | "category-card"
  | "category-hero"
  | "category-thumb"
  | "hero"
  | "recipe-card"
  | "recipe-hero"
  | "recipe-product"
  | "journal-card"
  | "journal-hero"
  | "journal-product";

export type MediaFormat = "avif" | "webp" | "jpeg" | "png";
export type MediaFit = "cover" | "contain" | "inside";

export interface StorefrontMediaPolicy {
  /** Primary transform width (also used as the img width attribute). */
  width: number;
  /** Optional fixed height for the transform pipeline. */
  height?: number;
  /** srcset ladder for storage-key transforms. */
  widths: number[];
  /** Responsive sizes attribute. */
  sizes: string;
  format: MediaFormat;
  quality: number;
  fit: MediaFit;
  /** Fallback monogram when media is missing or fails. */
  monogram: string;
  /** Optional fallback caption under the monogram. */
  label?: string;
  /** Prefer eager load for LCP-critical slots. */
  priority?: boolean;
  /** Tailwind classes applied to the failed/missing fallback surface. */
  fallbackClassName?: string;
}

const PRODUCT_CARD_SIZES =
  "(max-width: 639px) calc(100vw - 2.5rem), (max-width: 727px) calc(100vw - 4rem), (max-width: 1023px) calc((100vw - 5.5rem) / 2), (max-width: 1279px) calc((100vw - 7.5rem) / 2), 24rem";

const CARD_FALLBACK = "from-accent/45 via-card to-secondary";
const HERO_FALLBACK = "from-card via-card to-background";

export const STOREFRONT_MEDIA_POLICY: Record<
  StorefrontMediaSlot,
  StorefrontMediaPolicy
> = {
  "product-card": {
    // Match the card media frame (4:3) so transforms do not invent a tall crop.
    width: 800,
    height: 600,
    widths: [320, 480, 640, 800],
    sizes: PRODUCT_CARD_SIZES,
    format: "webp",
    quality: 82,
    fit: "cover",
    monogram: "ر",
    fallbackClassName: CARD_FALLBACK,
  },
  "product-gallery": {
    width: 1200,
    widths: [480, 800, 1200, 1600],
    sizes: "(max-width: 1024px) 100vw, 50vw",
    format: "webp",
    quality: 84,
    fit: "contain",
    monogram: "ر",
    fallbackClassName: CARD_FALLBACK,
  },
  "product-thumb": {
    width: 160,
    widths: [80, 120, 160, 240],
    sizes: "4rem",
    format: "webp",
    quality: 78,
    fit: "cover",
    monogram: "ر",
    fallbackClassName: CARD_FALLBACK,
  },
  recommendation: {
    // Match the wide scroll-snap rail from mobile peek through desktop.
    width: 720,
    height: 540,
    widths: [280, 400, 560, 720],
    sizes:
      "(max-width: 391px) calc(100vw - 4.5rem), (max-width: 639px) 20rem, (max-width: 1023px) 21.5rem, (max-width: 1279px) 22rem, 22.5rem",
    format: "webp",
    quality: 80,
    fit: "cover",
    monogram: "ر",
    fallbackClassName: CARD_FALLBACK,
  },
  "brand-tile": {
    width: 640,
    height: 360,
    widths: [320, 480, 640, 800],
    sizes:
      "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 20rem",
    format: "webp",
    quality: 80,
    fit: "cover",
    monogram: "ب",
    fallbackClassName: CARD_FALLBACK,
  },
  wishlist: {
    width: 640,
    widths: [240, 360, 480, 640],
    sizes: "(max-width: 640px) 40vw, 12rem",
    format: "webp",
    quality: 80,
    fit: "cover",
    monogram: "ر",
    fallbackClassName: CARD_FALLBACK,
  },
  "category-card": {
    width: 800,
    widths: [320, 480, 640, 800],
    sizes: "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw",
    format: "webp",
    quality: 80,
    fit: "cover",
    monogram: "د",
    fallbackClassName: CARD_FALLBACK,
  },
  "category-hero": {
    width: 1600,
    widths: [640, 960, 1280, 1600],
    sizes: "100vw",
    format: "webp",
    quality: 82,
    fit: "cover",
    monogram: "د",
    priority: true,
    fallbackClassName: HERO_FALLBACK,
  },
  "category-thumb": {
    width: 120,
    widths: [64, 96, 120, 160],
    sizes: "3rem",
    format: "webp",
    quality: 78,
    fit: "cover",
    monogram: "د",
    fallbackClassName: CARD_FALLBACK,
  },
  hero: {
    width: 1920,
    widths: [640, 960, 1280, 1600, 1920],
    sizes: "100vw",
    format: "webp",
    quality: 82,
    fit: "cover",
    monogram: "ر",
    priority: true,
    fallbackClassName: HERO_FALLBACK,
  },
  "recipe-card": {
    width: 800,
    widths: [320, 480, 640, 800],
    sizes: "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw",
    format: "webp",
    quality: 80,
    fit: "cover",
    monogram: "د",
    fallbackClassName: CARD_FALLBACK,
  },
  "recipe-hero": {
    width: 1400,
    widths: [640, 960, 1200, 1400],
    sizes: "(max-width: 1024px) 100vw, 60vw",
    format: "webp",
    quality: 84,
    fit: "cover",
    monogram: "د",
    priority: true,
    fallbackClassName: HERO_FALLBACK,
  },
  "recipe-product": {
    width: 320,
    widths: [160, 240, 320, 400],
    sizes: "8rem",
    format: "webp",
    quality: 80,
    fit: "cover",
    monogram: "ر",
    fallbackClassName: CARD_FALLBACK,
  },
  "journal-card": {
    width: 800,
    widths: [320, 480, 640, 800],
    sizes: "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw",
    format: "webp",
    quality: 80,
    fit: "cover",
    monogram: "م",
    fallbackClassName: CARD_FALLBACK,
  },
  "journal-hero": {
    width: 1400,
    widths: [640, 960, 1200, 1400],
    sizes: "(max-width: 1024px) 100vw, 70vw",
    format: "webp",
    quality: 84,
    fit: "cover",
    monogram: "م",
    priority: true,
    fallbackClassName: HERO_FALLBACK,
  },
  "journal-product": {
    width: 320,
    widths: [160, 240, 320, 400],
    sizes: "8rem",
    format: "webp",
    quality: 80,
    fit: "cover",
    monogram: "ر",
    fallbackClassName: CARD_FALLBACK,
  },
};

/**
 * Extract a storage key from a canonical `/media/{key}` (or absolute media)
 * URL so callers that only have `image_url` can still use the transform pipeline.
 */
export function storageKeyFromMediaUrl(
  url: string | null | undefined,
): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  try {
    const path =
      trimmed.startsWith("http://") || trimmed.startsWith("https://")
        ? new URL(trimmed).pathname
        : trimmed;
    if (!path.includes("/media/")) return null;
    return normalizeMediaStorageKey(path);
  } catch {
    return null;
  }
}

export function resolveStorefrontMediaSource(input: {
  storageKey?: string | null;
  src?: string | null;
}): { imageKey: string | null; src: string | null } {
  const explicitKey = normalizeMediaStorageKey(input.storageKey);
  if (explicitKey) {
    return { imageKey: explicitKey, src: input.src ?? null };
  }
  const derived = storageKeyFromMediaUrl(input.src);
  if (derived) {
    return { imageKey: derived, src: input.src ?? null };
  }
  return { imageKey: null, src: input.src ?? null };
}

export function mediaPolicyFor(
  slot: StorefrontMediaSlot,
): StorefrontMediaPolicy {
  return STOREFRONT_MEDIA_POLICY[slot];
}
