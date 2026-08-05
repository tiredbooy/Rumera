import "server-only";

import type { ApiFetchOptions } from "@/lib/api/client";
import { isApiNotFoundError } from "@/lib/api/error-semantics";
import { publicRequest } from "@/lib/api/public";
import type { Paginated } from "@/lib/api/types";
import {
  HOME_CACHE_TAG,
  PRODUCT_CATALOGUE_CACHE_TAG,
  productDetailCacheTag,
} from "@/lib/cache-tags";
import { buildQueryString } from "@/lib/utils/api-helpers";
import type { PublicProductListQuery } from "../queries";
import type { ProductListItem, ProductDetail } from "../types";

/**
 * Catalogue list is tag-cached so admin product/media writes can expire home +
 * listing surfaces immediately. Availability is still refreshed on a short TTL.
 */
const PRODUCT_LIST_OPTIONS: ApiFetchOptions = {
  cache: "force-cache",
  next: {
    revalidate: 60,
    tags: [PRODUCT_CATALOGUE_CACHE_TAG, HOME_CACHE_TAG],
  },
};

/** Detail keeps a short TTL + per-product tag; inventory stays relatively fresh. */
const PRODUCT_DETAIL_OPTIONS: ApiFetchOptions = {
  cache: "force-cache",
  next: { revalidate: 30 },
};

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
// Product detail
// ─────────────────────────────────────────────

/** Product detail includes volatile inventory; only a typed 404 means missing. */
export async function getProductById(
  id: number,
): Promise<ProductDetail | null> {
  try {
    return await publicRequest<ProductDetail>(`/products/${id}`, {
      ...PRODUCT_DETAIL_OPTIONS,
      next: {
        revalidate: 30,
        tags: [
          productDetailCacheTag(id),
          PRODUCT_CATALOGUE_CACHE_TAG,
        ],
      },
    });
  } catch (error) {
    if (isApiNotFoundError(error)) return null;
    throw error;
  }
}

/** Exact public slug lookup; only a typed 404 means missing. */
export async function getProductBySlug(
  slug: string,
): Promise<ProductDetail | null> {
  try {
    return await publicRequest<ProductDetail>(
      `/products/slug/${encodeURIComponent(slug)}`,
      {
        ...PRODUCT_DETAIL_OPTIONS,
        next: {
          revalidate: 30,
          tags: [
            productDetailCacheTag(slug),
            PRODUCT_CATALOGUE_CACHE_TAG,
          ],
        },
      },
    );
  } catch (error) {
    if (isApiNotFoundError(error)) return null;
    throw error;
  }
}

/** Slugs used for static generation; missing slugs are not valid routes. */
export async function allProductSlugs(): Promise<string[]> {
  const slugs: string[] = [];
  let page = 1;

  for (;;) {
    const result = await listProducts({ page, limit: 100 });
    slugs.push(
      ...result.results.flatMap((product) =>
        product.slug ? [product.slug] : [],
      ),
    );
    if (!result.pagination.has_next || result.results.length === 0)
      return slugs;
    page += 1;
  }
}
