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

export const getBrandBySlug = cache(
  (slug: string): Promise<Brand> =>
    publicRequest<Brand>(`/brands/slug/${encodeURIComponent(slug)}`),
);

/** Lightweight brand chip for marquee / discovery links. */
export type FeaturedBrand = {
  id: number;
  title: string;
  slug?: string;
};

/**
 * Featured brands for homepage discovery. Real ids/slugs deep-link to
 * `/products?brand=…`. A successful empty catalogue is `[]`. API/network
 * failures propagate — do not invent Western liquor names.
 */
export async function getFeaturedBrands(limit = 16): Promise<FeaturedBrand[]> {
  const page = await publicRequest<Paginated<Brand>>(
    `/brands${buildQueryString({ limit, sortBy: "title", orderBy: "asc" })}`,
    PUBLIC_CACHE_OPTIONS,
  );
  return (page.results ?? [])
    .map((brand) => ({
      id: brand.id,
      title: brand.title.trim(),
      slug: brand.slug,
    }))
    .filter((brand) => brand.title.length > 0 && brand.id > 0);
}
