/**
 * Public catalogue fetchers (server-side, ISR-cached). All are error-safe: on a
 * network/HTTP failure they return an empty/fallback value so `next build` and
 * page rendering never hard-fail when the backend is unreachable.
 */
import { buildQuery } from "@/lib/api/qs"
import type { Paginated, ProductListItem, ProductDetail } from "./types"

const API = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"
const BASE = `${API.replace(/\/$/, "")}/api/v1`
const REVALIDATE = 3600

const emptyPage = <T>(): Paginated<T> => ({
  results: [],
  pagination: { page: 1, limit: 0, total_items: 0, total_pages: 0, has_next: false, has_prev: false },
})

async function publicGet<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${BASE}${path}`, { next: { revalidate: REVALIDATE } })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

export type ProductListParams = {
  page?: number
  limit?: number
  search?: string
  category_id?: number
  brand_id?: number
  tag_id?: number
  min_price?: number
  max_price?: number
  sortBy?: string
  orderBy?: "asc" | "desc"
}

export async function listProducts(params: ProductListParams = {}): Promise<Paginated<ProductListItem>> {
  const page = await publicGet<Paginated<ProductListItem>>(`/products${buildQuery(params)}`)
  return page ?? emptyPage<ProductListItem>()
}

export async function getProductById(id: number): Promise<ProductDetail | null> {
  const body = await publicGet<{ data: ProductDetail }>(`/products/${id}`)
  return body?.data ?? null
}

/**
 * Resolve a SEO slug to a full product. The detail endpoint is keyed by numeric
 * id, so we search the list for the slug, then hydrate by id.
 */
export async function getProductBySlug(slug: string): Promise<ProductDetail | null> {
  const page = await listProducts({ search: slug, limit: 5 })
  const match = page.results.find((p) => p.slug === slug) ?? page.results[0]
  if (!match) return null
  return getProductById(match.id)
}

export async function getFeatured(limit = 8): Promise<ProductListItem[]> {
  const page = await listProducts({ limit, sortBy: "created_at", orderBy: "desc" })
  return page.results
}

/** All slugs for generateStaticParams (capped; returns [] on failure → on-demand ISR). */
export async function allProductSlugs(): Promise<string[]> {
  const page = await listProducts({ limit: 100 })
  return page.results.map((p) => p.slug)
}
