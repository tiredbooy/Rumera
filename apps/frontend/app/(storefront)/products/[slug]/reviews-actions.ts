"use server"

/**
 * Server Actions for the PDP reviews block. The public reviews list endpoint
 * isn't reachable from the browser in production (the API is loopback-bound), so
 * the client calls these actions, which run the existing server-side fetcher.
 * Used for "load more" pagination and star filtering without an auth round-trip.
 */
import { listReviews, type Review } from "@/lib/catalog/reviews"

export async function fetchReviewsPage(
  productId: number,
  params: { page?: number; limit?: number; rating?: number }
): Promise<{ reviews: Review[]; hasNext: boolean }> {
  const page = await listReviews(productId, params)
  return { reviews: page.results, hasNext: page.pagination.has_next }
}
