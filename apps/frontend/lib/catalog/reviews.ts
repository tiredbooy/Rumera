/**
 * Public review fetchers (server-side, ISR-cached, error-safe). Power the PDP
 * reviews block and feed the product's aggregate rating into JSON-LD/metadata.
 */
import { buildQuery } from "@/lib/api/qs"
import type { Paginated } from "./types"

const API = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"
const BASE = `${API.replace(/\/$/, "")}/api/v1`
const REVALIDATE = 600

export type ReviewImage = {
  id: number
  review_id: number
  image_url: string
  alt_text?: string
  sort_order: number
}

export type Review = {
  id: number
  title: string
  content: string
  rating: number
  user_id: number
  user_full_name: string // empty from the list endpoint today
  product_id: number
  like_count: number
  dislike_count: number
  verified_purchase: boolean
  images?: ReviewImage[] | null
  status: "pending" | "approved" | "rejected"
  created_at: string
}

export type RatingSummary = {
  product_id: number
  average_rating: number
  total_reviews: number
  distribution: Record<"1" | "2" | "3" | "4" | "5", number>
}

const emptyReviews = (): Paginated<Review> => ({
  results: [],
  pagination: { page: 1, limit: 0, total_items: 0, total_pages: 0, has_next: false, has_prev: false },
})

export async function getReviewSummary(productId: number): Promise<RatingSummary | null> {
  try {
    const res = await fetch(`${BASE}/products/${productId}/reviews/summary`, {
      next: { revalidate: REVALIDATE },
    })
    if (!res.ok) return null
    const body = (await res.json()) as { data?: RatingSummary }
    return body?.data ?? null
  } catch {
    return null
  }
}

export async function listReviews(
  productId: number,
  params: { page?: number; limit?: number; rating?: number; verified?: boolean } = {}
): Promise<Paginated<Review>> {
  try {
    const res = await fetch(`${BASE}/products/${productId}/reviews${buildQuery(params)}`, {
      next: { revalidate: REVALIDATE },
    })
    if (!res.ok) return emptyReviews()
    return (await res.json()) as Paginated<Review>
  } catch {
    return emptyReviews()
  }
}
