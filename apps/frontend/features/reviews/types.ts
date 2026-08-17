import type { PaginationQuery } from "@/lib/api/types";

export type ReviewStatus = "pending" | "approved" | "rejected";
export type ReviewRating = 1 | 2 | 3 | 4 | 5;
export type ReviewRatingKey = `${ReviewRating}`;

export interface ReviewImage {
  id: number;
  review_id: number;
  image_url: string;
  alt_text: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Review {
  id: number;
  title: string;
  content: string;
  rating: ReviewRating;
  user_id: number;
  user_full_name: string;
  product_id: number;
  product_title?: string;
  like_count: number;
  images: ReviewImage[];
  dislike_count: number;
  verified_purchase: boolean;
  status: ReviewStatus;
  created_at: string;
}

export interface AdminReview extends Review {
  deleted_at?: string;
  updated_at: string;
}

export interface AccountReview {
  id: number;
  product_id: number;
  product_slug?: string;
  product_title: string;
  image_url?: string;
  rating: ReviewRating;
  content: string;
  status: ReviewStatus;
  created_at: string;
}

export interface PendingReview {
  product_id: number;
  product_slug?: string;
  product_title: string;
  image_url?: string;
  order_id: number;
  delivered_at?: string;
}

export interface ProductRatingSummary {
  product_id: number;
  average_rating: number;
  total_reviews: number;
  distribution: Record<ReviewRatingKey, number>;
}

export interface CreateReviewInput {
  title: string;
  content: string;
  rating: ReviewRating;
  product_id: number;
}

/** JSON null and omission both decode to nil pointers in the current PATCH DTO. */
export interface UpdateReviewInput {
  title?: string | null;
  content?: string | null;
  rating?: ReviewRating | null;
}

export interface ModerateReviewInput {
  status: ReviewStatus;
}

export interface ReviewReactionInput {
  like: boolean;
}

/** `review_id` is supplied by the route and must not be sent by clients. */
export interface AddReviewImageInput {
  image_url: string;
  alt_text?: string | null;
  sort_order?: number | null;
}

export type ReviewSortField = "created_at" | "rating" | "like_count";

export interface ReviewListQuery extends PaginationQuery {
  sortBy?: ReviewSortField;
  orderBy?: "asc" | "desc";
  product_id?: number;
  user_id?: number;
  status?: ReviewStatus;
  rating?: ReviewRating;
  verified?: boolean;
}

export type ProductReviewListQuery = Pick<
  ReviewListQuery,
  "page" | "limit" | "sortBy" | "orderBy" | "rating"
>;
