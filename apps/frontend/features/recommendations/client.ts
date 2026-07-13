"use client";

import { storeRequest } from "@/lib/api/store-client";
import type { ApiSuccess } from "@/lib/api/types";
import { buildQueryString } from "@/lib/utils/api-helpers";

import type {
  RecommendationInteractionInput,
  RecommendationItem,
  RecommendationProfile,
  RecommendationQuery,
} from "./types";

export function getForYouClient(
  query: RecommendationQuery = {},
): Promise<RecommendationItem[]> {
  return storeRequest<ApiSuccess<RecommendationItem[]>>(
    `recommendations/for-you${buildQueryString(query)}`,
  ).then((body) => body.data);
}

export function recordInteractionClient(
  input: RecommendationInteractionInput,
): Promise<void> {
  return storeRequest<void>("recommendations/interactions", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getRecommendationProfileClient(): Promise<RecommendationProfile> {
  return storeRequest<ApiSuccess<RecommendationProfile>>(
    "recommendations/profile",
  ).then((body) => body.data);
}

export function recomputeRecommendationProfileClient(): Promise<RecommendationProfile> {
  return storeRequest<ApiSuccess<RecommendationProfile>>(
    "recommendations/profile/recompute",
    { method: "POST" },
  ).then((body) => body.data);
}
