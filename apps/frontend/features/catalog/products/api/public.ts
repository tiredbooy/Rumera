import "server-only";

import type { ApiFetchOptions } from "@/lib/api/client";
import { isApiNotFoundError } from "@/lib/api/error-semantics";
import { publicRequest } from "@/lib/api/public";
import type { Paginated } from "@/lib/api/types";
import { buildQueryString } from "@/lib/utils/api-helpers";
import type { PublicProductListQuery } from "../queries";
import type { ProductListItem, ProductDetail } from "../types";

const PRODUCT_LIST_OPTIONS: ApiFetchOptions = { cache: "no-store" };
const PRODUCT_DETAIL_OPTIONS: ApiFetchOptions = { cache: "no-store" };

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
    return await publicRequest<ProductDetail>(
      `/products/${id}`,
      PRODUCT_DETAIL_OPTIONS,
    );
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
      PRODUCT_DETAIL_OPTIONS,
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
