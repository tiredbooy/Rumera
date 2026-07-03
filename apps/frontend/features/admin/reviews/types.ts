// types/review.ts
import { BaseFilter } from "@/lib/types/filters";

// ------------------------------------------------
// Enums / string unions
// ------------------------------------------------

export type ReviewStatus = "pending" | "approved" | "rejected";

// ------------------------------------------------
// Nested types (ReviewImage)
// ------------------------------------------------

export interface ReviewImage {
  id: number;
  review_id: number;
  image_url: string;
  alt_text: string; // note: might be empty string, but field exists
  sort_order: number;
  created_at: string; // ISO datetime
  updated_at: string; // ISO datetime
}

// ------------------------------------------------
// Response types
// ------------------------------------------------

// Public review response (used for product pages)
export interface ReviewResponse {
  id: number;
  title: string;
  content: string;
  rating: number; // 1-5
  user_id: number;
  user_full_name: string;
  product_id: number;
  like_count: number;
  images: ReviewImage[];
  dislike_count: number;
  verified_purchase: boolean;
  status: ReviewStatus;
  created_at: string; // ISO datetime
}

// Admin review response (extends ReviewResponse)
export interface ReviewAdminResponse extends ReviewResponse {
  deleted_at?: string | null; // ISO datetime (soft delete)
  updated_at: string; // ISO datetime
}

// ------------------------------------------------
// Product rating summary
// ------------------------------------------------

export interface ProductRatingSummary {
  product_id: number;
  average_rating: number;
  total_reviews: number;
  distribution: Record<number, number>; // {1: 3, 2: 5, ...}
}

// ------------------------------------------------
// Request payloads
// ------------------------------------------------

export interface CreateReviewReq {
  title: string;
  content: string;
  rating: number; // 1-5
  product_id: number;
}

export interface UpdateReviewReq {
  title?: string | null;
  content?: string | null;
  rating?: number | null; // 1-5
}

export interface UpdateReviewStatusReq {
  status: ReviewStatus;
}

export interface ReviewImageReq {
  review_id: number;
  image_url: string;
  alt_text?: string | null;
  sort_order?: number | null;
}

// ------------------------------------------------
// Filter (extends BaseFilter)
// ------------------------------------------------

export interface ReviewFilter extends BaseFilter {
  product_id?: number;
  user_id?: number;
  status?: ReviewStatus;
  rating?: number; // 1-5
  verified?: boolean;
}
