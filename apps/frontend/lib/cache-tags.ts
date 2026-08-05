/**
 * Canonical Next.js fetch/cache tags for storefront surfaces.
 * Admin mutations revalidate these via getAdminRevalidationPlan so successful
 * writes do not wait on arbitrary TTLs.
 */

export const HOME_CACHE_TAG = "storefront:home";
export const PRODUCT_CATALOGUE_CACHE_TAG = "storefront:products";
export const CATEGORY_DIRECTORY_CACHE_TAG = "storefront:categories";
export const HERO_CACHE_TAG = "storefront:hero";
export const RECOMMENDATION_CACHE_TAG = "storefront:recommendations";
export const RECIPE_CACHE_TAG = "storefront:recipes";
export const JOURNAL_CACHE_TAG = "storefront:journal";
export const BRAND_CACHE_TAG = "storefront:brands";

/** Per-product detail tag (id or slug). Prefer id when known from admin routes. */
export function productDetailCacheTag(idOrSlug: string | number): string {
  return `storefront:product:${idOrSlug}`;
}

/** Surfaces that always include the homepage shell (hero, catalogue, rails). */
export const HOME_SURFACE_TAGS = [
  HOME_CACHE_TAG,
  HERO_CACHE_TAG,
  PRODUCT_CATALOGUE_CACHE_TAG,
  RECOMMENDATION_CACHE_TAG,
  CATEGORY_DIRECTORY_CACHE_TAG,
  BRAND_CACHE_TAG,
] as const;
