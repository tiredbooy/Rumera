/**
 * Canonical Rumera brand assets and metadata.
 *
 * Source files live under `public/logo/` (audited dimensions below). Do not
 * invent new artwork paths here — add files to that directory first, then
 * register them. The reusable UI entry point is `RumeraBrandMark`.
 *
 * Naming note: dark variants are stored as `Rumra-Dark.*` (typo in source
 * filenames). Paths stay as shipped so deploys do not break; use the constants
 * below rather than hardcoding strings.
 */

/** Intrinsic pixel size of a logo source (for aspect-ratio and next/image). */
export type BrandAssetSize = {
  width: number;
  height: number;
  /** Public URL path (leading slash). */
  src: string;
};

export type BrandMarkPair = {
  /** Prefer SVG in UI; PNG for OG / older contexts. */
  svg: BrandAssetSize;
  png: BrandAssetSize;
};

/**
 * Inventory of shipped logo files (measured with `file` / image headers).
 *
 * - **onLight**: black monogram, transparent background — light surfaces.
 * - **onDark**: solid dark-field badge (full canvas) — dark surfaces & app icons.
 */
export const brandMarks = {
  onLight: {
    svg: {
      src: "/logo/Rumera-Light.svg",
      width: 446,
      height: 377,
    },
    png: {
      src: "/logo/Rumera-Light.png",
      width: 446,
      height: 377,
    },
  },
  onDark: {
    svg: {
      src: "/logo/Rumra-Dark.svg",
      width: 435,
      height: 388,
    },
    png: {
      src: "/logo/Rumra-Dark.png",
      width: 435,
      height: 388,
    },
  },
} as const satisfies Record<string, BrandMarkPair>;

/** Approximate mark aspect ratio (width / height) for layout reserves. */
export const BRAND_MARK_ASPECT =
  brandMarks.onLight.png.width / brandMarks.onLight.png.height;

export const brandCopy = {
  /** Persian wordmark as shown in UI. */
  wordmarkFa: "رومرا",
  /** Latin brand for metadata / English OG lines. */
  wordmarkEn: "Rumera",
  /** Default accessible name when the mark is the sole identity cue. */
  alt: "نشان رومرا",
  /** Home control label. */
  homeAriaLabel: "رومرا — خانه",
} as const;

/** Paths used by metadata, JSON-LD, and install surfaces. */
export const brandPaths = {
  /** Default browser tab / PWA icon (dark-field badge reads on any theme). */
  iconPng: brandMarks.onDark.png.src,
  iconSvg: brandMarks.onDark.svg.src,
  /** Apple touch prefers a non-transparent square-ish badge. */
  appleTouch: brandMarks.onDark.png.src,
  /** Light-surface mark for documents on white backgrounds. */
  printMark: brandMarks.onLight.png.src,
  /** Generated OG route (enhanced in opengraph-image). */
  openGraph: "/opengraph-image",
} as const;

/**
 * Mark height → width using the light asset aspect (stable CLS reserve).
 * Heights are chosen for 44px touch targets when paired with wordmark.
 */
export const brandMarkHeights = {
  xs: 28,
  sm: 32,
  md: 36,
  lg: 44,
  xl: 56,
} as const;

export type BrandMarkSize = keyof typeof brandMarkHeights;

export function brandMarkBox(size: BrandMarkSize): {
  height: number;
  width: number;
} {
  const height = brandMarkHeights[size];
  return {
    height,
    width: Math.round(height * BRAND_MARK_ASPECT),
  };
}
