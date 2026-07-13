"use server";

import { revalidateTag } from "next/cache";

import { ApiError } from "@/lib/api/client";

import {
  createReview,
  deleteReview,
  listProductReviews,
  moderateReview,
  reactToReview,
  reviewCacheTag,
  updateReview,
} from "./api";
import type {
  AdminReview,
  CreateReviewInput,
  ModerateReviewInput,
  ProductReviewListQuery,
  Review,
  ReviewReactionInput,
  UpdateReviewInput,
} from "./types";

export type ReviewActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; message: string };

function failure(error: unknown): ReviewActionResult<never> {
  if (error instanceof ApiError) {
    return { ok: false, status: error.status, message: error.message };
  }
  return { ok: false, status: 500, message: "عملیات دیدگاه ناموفق بود" };
}

export async function fetchReviewsPage(
  productId: number,
  query: ProductReviewListQuery,
): Promise<{ reviews: Review[]; hasNext: boolean }> {
  const page = await listProductReviews(productId, query);
  return { reviews: page.results, hasNext: page.pagination.has_next };
}

export async function createReviewAction(
  input: CreateReviewInput,
): Promise<ReviewActionResult<Review>> {
  try {
    return { ok: true, data: await createReview(input) };
  } catch (error) {
    return failure(error);
  }
}

export async function updateReviewAction(
  id: number,
  productId: number,
  input: UpdateReviewInput,
): Promise<ReviewActionResult<Review>> {
  try {
    const review = await updateReview(id, input);
    revalidateTag(reviewCacheTag(productId), "max");
    return { ok: true, data: review };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteReviewAction(
  id: number,
  productId: number,
): Promise<ReviewActionResult<null>> {
  try {
    await deleteReview(id);
    revalidateTag(reviewCacheTag(productId), "max");
    return { ok: true, data: null };
  } catch (error) {
    return failure(error);
  }
}

export async function reactToReviewAction(
  id: number,
  productId: number,
  input: ReviewReactionInput,
): Promise<ReviewActionResult<null>> {
  try {
    await reactToReview(id, input);
    revalidateTag(reviewCacheTag(productId), "max");
    return { ok: true, data: null };
  } catch (error) {
    return failure(error);
  }
}

export async function moderateReviewAction(
  id: number,
  productId: number,
  input: ModerateReviewInput,
): Promise<ReviewActionResult<AdminReview>> {
  try {
    const review = await moderateReview(id, input);
    revalidateTag(reviewCacheTag(productId), "max");
    return { ok: true, data: review };
  } catch (error) {
    return failure(error);
  }
}
