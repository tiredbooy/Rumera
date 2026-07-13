import "server-only";

import { apiFetch } from "@/lib/api/client";
import { publicRequest } from "@/lib/api/public";
import type { Paginated } from "@/lib/api/types";
import { buildQueryString } from "@/lib/utils/api-helpers";
import type {
  AdminReview,
  CreateReviewInput,
  ModerateReviewInput,
  ProductRatingSummary,
  ProductReviewListQuery,
  Review,
  ReviewImage,
  ReviewListQuery,
  ReviewReactionInput,
  UpdateReviewInput,
} from "./types";

export const reviewCacheTag = (productId: number) =>
  `product-reviews:${productId}`;

const emptyReviews = (
  query: ProductReviewListQuery,
): Paginated<Review> => ({
  results: [],
  pagination: {
    page: query.page ?? 1,
    limit: query.limit ?? 0,
    total_items: 0,
    total_pages: 0,
    has_next: false,
    has_prev: false,
  },
});

export async function listProductReviews(
  productId: number,
  query: ProductReviewListQuery = {},
): Promise<Paginated<Review>> {
  try {
    return await publicRequest<Paginated<Review>>(
      `/products/${productId}/reviews${buildQueryString(query)}`,
      {
        next: {
          revalidate: 600,
          tags: [reviewCacheTag(productId)],
        },
        cache: "force-cache",
      },
    );
  } catch {
    return emptyReviews(query);
  }
}

export async function getProductRatingSummary(
  productId: number,
): Promise<ProductRatingSummary | null> {
  try {
    return await publicRequest<ProductRatingSummary>(
      `/products/${productId}/reviews/summary`,
      {
        next: {
          revalidate: 600,
          tags: [reviewCacheTag(productId)],
        },
        cache: "force-cache",
      },
    );
  } catch {
    return null;
  }
}

export function getReview(id: number): Promise<Review> {
  return publicRequest<Review>(`/reviews/${id}`);
}

export function getReviewImages(id: number): Promise<ReviewImage[]> {
  return apiFetch<ReviewImage[]>(`/reviews/${id}/images`);
}

export function createReview(input: CreateReviewInput): Promise<Review> {
  return apiFetch<Review>("/reviews", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateReview(
  id: number,
  input: UpdateReviewInput,
): Promise<Review> {
  return apiFetch<Review>(`/reviews/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteReview(id: number): Promise<void> {
  return apiFetch<void>(`/reviews/${id}`, { method: "DELETE" });
}

export function reactToReview(
  id: number,
  input: ReviewReactionInput,
): Promise<void> {
  return apiFetch<void>(`/reviews/${id}/react`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function listAdminReviews(
  query: ReviewListQuery = {},
): Promise<Paginated<AdminReview>> {
  return apiFetch<Paginated<AdminReview>>(
    `/admin/reviews${buildQueryString(query)}`,
  );
}

export function moderateReview(
  id: number,
  input: ModerateReviewInput,
): Promise<AdminReview> {
  return apiFetch<AdminReview>(`/admin/reviews/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}
