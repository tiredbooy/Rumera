// features/catalog/brands/api.ts
import { cache } from "react";
import { apiFetch } from "@/lib/api/client";
import { buildQueryString } from "@/lib/utils/api-helpers";
import type { Brand, BrandFilter } from "./types";

// ─────────────────────────────────────────────
// Public brand list
// ─────────────────────────────────────────────

/**
 * Fetch paginated list of brands (public).
 * Optional filters: search, page, limit.
 */
export function fetchBrands(
  filter: BrandFilter = {},
): Promise<{ items: Brand[]; total: number }> {
  return apiFetch<{ items: Brand[]; total: number }>(
    `/brands${buildQueryString(filter)}`,
  );
}

// ─────────────────────────────────────────────
// Single brand detail (cached per request)
// ─────────────────────────────────────────────

/**
 * Fetch a single brand by ID.
 * React's `cache()` dedupes concurrent calls in the same render pass.
 */
export const fetchBrand = cache(
  (id: number): Promise<Brand> => apiFetch<Brand>(`/brands/${id}`),
);
