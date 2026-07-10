// features/catalog/api.ts
import { cache } from "react";
import { apiFetch } from "@/lib/api/client";
import { buildQueryString } from "@/lib/utils/api-helpers";
import type {
  ProductFilter,
  ProductListItem,
  ProductDetail,
  ImageResponse,
  TagResponse,
  VariantResponse,
} from "@/features/admin/products/types";

// ─────────────────────────────────────────────
// Product list (public – active only)
// ─────────────────────────────────────────────

export function fetchProducts(
  filter: Omit<ProductFilter, "is_active"> = {},
): Promise<{ items: ProductListItem[]; total: number }> {
  return apiFetch<{ items: ProductListItem[]; total: number }>(
    `/products${buildQueryString(filter)}`,
  );
}

// ─────────────────────────────────────────────
// Product detail (cached per request)
// ─────────────────────────────────────────────

export const fetchProductDetail = cache(
  (id: number): Promise<ProductDetail> =>
    apiFetch<ProductDetail>(`/products/${id}`),
);

// ─────────────────────────────────────────────
// Product tags
// ─────────────────────────────────────────────

export function fetchProductTags(id: number): Promise<TagResponse[]> {
  return apiFetch<TagResponse[]>(`/products/${id}/tags`);
}

// ─────────────────────────────────────────────
// Product images
// ─────────────────────────────────────────────

export function fetchProductImages(id: number): Promise<ImageResponse[]> {
  return apiFetch<ImageResponse[]>(`/products/${id}/images`);
}

// ─────────────────────────────────────────────
// Product variants
// ─────────────────────────────────────────────

export function fetchProductVariants(id: number): Promise<VariantResponse[]> {
  return apiFetch<VariantResponse[]>(`/products/${id}/variants`);
}
