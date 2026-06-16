/**
 * Public recommendation fetchers (server-side, ISR-cached, error-safe). Surface
 * the backend recommendation engine (`/recommendations/*`). Like the rest of
 * `lib/catalog`, every call returns a safe empty value on failure so rendering
 * never hard-fails when the backend is unreachable.
 */
import { buildQuery } from "@/lib/api/qs"

const API = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"
const BASE = `${API.replace(/\/$/, "")}/api/v1`
const REVALIDATE = 1800

/** A single recommended product. Note `product_id` (not `id`) and `min/max_price`. */
export type RecommendationItem = {
  product_id: number
  title: string
  slug?: string
  brand_id?: number
  brand?: string
  category_id?: number
  min_price: number
  max_price: number
  image_url?: string
  score: number
  reason?: "trending" | "similar" | "frequently_bought_together" | "for_you" | "recipe"
}

type RecParams = { limit?: number; category_id?: number; window_days?: number }

async function fetchRecs(path: string): Promise<RecommendationItem[]> {
  try {
    const res = await fetch(`${BASE}${path}`, { next: { revalidate: REVALIDATE } })
    if (!res.ok) return []
    const body = (await res.json()) as { data?: RecommendationItem[] }
    return body?.data ?? []
  } catch {
    return []
  }
}

/** Site-wide trending products (home rail). */
export async function getTrending(params: RecParams = {}): Promise<RecommendationItem[]> {
  return fetchRecs(`/recommendations/trending${buildQuery(params)}`)
}

/** Products similar to a given product (PDP rail). `productId` is the numeric id. */
export async function getSimilar(productId: number, params: RecParams = {}): Promise<RecommendationItem[]> {
  return fetchRecs(`/recommendations/products/${productId}/similar${buildQuery(params)}`)
}

/** "Frequently bought together" for a product (PDP rail); falls back to similar server-side. */
export async function getFrequentlyBoughtTogether(
  productId: number,
  params: RecParams = {}
): Promise<RecommendationItem[]> {
  return fetchRecs(`/recommendations/products/${productId}/frequently-bought-together${buildQuery(params)}`)
}
