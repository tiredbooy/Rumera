"use client";

import { storeRequest } from "@/lib/api/store-client";
import type {
  ApiErrorEnvelope,
  ApiSuccess,
  Paginated,
} from "@/lib/api/types";
import { buildQueryString } from "@/lib/utils/api-helpers";

import type {
  AccountReview,
  AdminReview,
  PendingReview,
  ReviewListQuery,
} from "./types";

export function listMyReviewsClient(): Promise<AccountReview[]> {
  return storeRequest<ApiSuccess<AccountReview[]>>("reviews/mine").then(
    (body) => body.data,
  );
}

export function listPendingReviewsClient(): Promise<PendingReview[]> {
  return storeRequest<ApiSuccess<PendingReview[]>>("reviews/pending").then(
    (body) => body.data,
  );
}

export async function listAdminReviewsClient(
  query: ReviewListQuery = {},
): Promise<Paginated<AdminReview>> {
  const response = await fetch(
    `/api/admin/admin/reviews${buildQueryString(query)}`,
  );
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = (body as ApiErrorEnvelope | null)?.error;
    throw new Error(error?.message ?? "خطا در دریافت دیدگاه‌ها");
  }
  return body as Paginated<AdminReview>;
}
