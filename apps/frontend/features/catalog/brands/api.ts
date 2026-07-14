import { cache } from "react";
import type { ApiFetchOptions } from "@/lib/api/client";
import { publicRequest } from "@/lib/api/public";
import type { Paginated } from "@/lib/api/types";
import { buildQueryString } from "@/lib/utils/api-helpers";
import type { Brand, BrandListQuery } from "./types";

const PUBLIC_CACHE_OPTIONS: ApiFetchOptions = {
  cache: "force-cache",
  next: { revalidate: 3600 },
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

export async function getFeaturedBrands(limit = 16): Promise<string[]> {
  try {
    const page = await publicRequest<Paginated<Brand>>(
      `/brands${buildQueryString({ limit })}`,
      PUBLIC_CACHE_OPTIONS,
    );
    const titles = page.results
      .map((brand) => brand.title.trim())
      .filter(Boolean);
    return titles.length > 0 ? titles : FALLBACK_BRANDS;
  } catch {
    return FALLBACK_BRANDS;
  }
}
