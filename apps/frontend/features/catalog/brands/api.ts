import { cache } from "react";
import type { ApiFetchOptions } from "@/lib/api/client";
import { publicRequest } from "@/lib/api/public";
import type { Paginated } from "@/lib/api/types";
import { BRAND_CACHE_TAG, HOME_CACHE_TAG } from "@/lib/cache-tags";
import { buildQueryString } from "@/lib/utils/api-helpers";
import type { Brand, BrandListQuery } from "./types";

const PUBLIC_CACHE_OPTIONS: ApiFetchOptions = {
  cache: "force-cache",
  next: { revalidate: 3600, tags: [BRAND_CACHE_TAG, HOME_CACHE_TAG] },
};

const FALLBACK_BRANDS = [
  "Johnnie Walker",
  "Jack Daniel's",
  "Absolut",
  "Hennessy",
  "Moët & Chandon",
  "Grey Goose",
  "Chivas Regal",
  "Glenfiddich",
  "Bombay Sapphire",
  "Bacardí",
  "Jameson",
  "The Macallan",
  "Belvedere",
  "Martini",
  "Campari",
  "Tanqueray",
];

/**
 * Fetch paginated list of brands (public).
 * Optional filters: search, page, limit.
 */
export function listBrands(
  filter: BrandListQuery = {},
): Promise<Paginated<Brand>> {
  return publicRequest<Paginated<Brand>>(
    `/brands${buildQueryString(filter)}`,
  );
}

export const getBrand = cache(
  (id: number): Promise<Brand> => publicRequest<Brand>(`/brands/${id}`),
);

/** Lightweight brand chip for marquee / discovery links. */
export type FeaturedBrand = {
  id: number;
  title: string;
};

/**
 * Featured brands for homepage discovery. Returns real ids when the API is
 * available so marquee items can deep-link to `/products?brand_id=…`.
 * On failure falls back to title-only chips (no inventing brand ids).
 */
export async function getFeaturedBrands(limit = 16): Promise<FeaturedBrand[]> {
  try {
    const page = await publicRequest<Paginated<Brand>>(
      `/brands${buildQueryString({ limit, sortBy: "title", orderBy: "asc" })}`,
      PUBLIC_CACHE_OPTIONS,
    );
    const brands = page.results
      .map((brand) => ({
        id: brand.id,
        title: brand.title.trim(),
      }))
      .filter((brand) => brand.title.length > 0 && brand.id > 0);
    if (brands.length > 0) return brands;
  } catch {
    // fall through to title-only fallback
  }

  return FALLBACK_BRANDS.map((title, index) => ({
    // Negative sentinel: never used as a query brand_id.
    id: -(index + 1),
    title,
  }));
}
