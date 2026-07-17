import "server-only";

import type { ApiFetchOptions } from "@/lib/api/client";
import { isApiNotFoundError } from "@/lib/api/error-semantics";
import { publicRequest } from "@/lib/api/public";
import type { Paginated } from "@/lib/api/types";
import { buildQueryString } from "@/lib/utils/api-helpers";
import type { PublicProductListQuery } from "../queries";
import type { ProductListItem, ProductDetail } from "../types";

const PUBLIC_CACHE_OPTIONS: ApiFetchOptions = {
  cache: "force-cache",
  next: { revalidate: 3600 },
};

const PRODUCT_LIST_OPTIONS: ApiFetchOptions = { cache: "no-store" };

// ─────────────────────────────────────────────
// Product list (public – active only)
// ─────────────────────────────────────────────

/** Public listing kept fresh because it includes live availability. */
export async function listProducts(
  filter: PublicProductListQuery = {},
): Promise<Paginated<ProductListItem>> {
  return publicRequest<Paginated<ProductListItem>>(
    `/products${buildQueryString(filter)}`,
    PRODUCT_LIST_OPTIONS,
  );
}

// ─────────────────────────────────────────────
// Product detail (cached per request)
// ─────────────────────────────────────────────

/** ISR-cached public detail lookup; only a typed 404 means missing. */
export async function getProductById(
  id: number,
): Promise<ProductDetail | null> {
  try {
    return await publicRequest<ProductDetail>(
      `/products/${id}`,
      PUBLIC_CACHE_OPTIONS,
    );
  } catch (error) {
    if (isApiNotFoundError(error)) return null;
    throw error;
  }
}

/** Resolve a public slug through the list projection, then hydrate by numeric id. */
export async function getProductBySlug(
  slug: string,
): Promise<ProductDetail | null> {
  const page = await listProducts({ search: slug, limit: 5 });
  const match = page.results.find((product) => product.slug === slug);
  return match ? getProductById(match.id) : null;
}

/** Slugs used for static generation; missing slugs are not valid routes. */
export async function allProductSlugs(): Promise<string[]> {
  const page = await listProducts({ limit: 100 });
  return page.results.flatMap((product) =>
    product.slug ? [product.slug] : [],
  );
}
