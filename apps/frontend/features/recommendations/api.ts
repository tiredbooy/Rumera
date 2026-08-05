import "server-only";

import type { ApiFetchOptions } from "@/lib/api/client";
import { publicRequest } from "@/lib/api/public";
import { RECOMMENDATION_CACHE_TAG } from "@/lib/cache-tags";
import { buildQueryString } from "@/lib/utils/api-helpers";
import type { RecommendationItem, RecommendationQuery } from "./types";

const PUBLIC_CACHE_OPTIONS: ApiFetchOptions = {
  cache: "force-cache",
  next: { revalidate: 1800, tags: [RECOMMENDATION_CACHE_TAG] },
};

async function listRecommendations(path: string): Promise<RecommendationItem[]> {
  try {
    return await publicRequest<RecommendationItem[]>(path, PUBLIC_CACHE_OPTIONS);
  } catch {
    return [];
  }
}

export function getTrending(
  query: RecommendationQuery = {},
): Promise<RecommendationItem[]> {
  return listRecommendations(
    `/recommendations/trending${buildQueryString(query)}`,
  );
}

export function getSimilar(
  productId: number,
  query: RecommendationQuery = {},
): Promise<RecommendationItem[]> {
  return listRecommendations(
    `/recommendations/products/${productId}/similar${buildQueryString(query)}`,
  );
}

export function getFrequentlyBoughtTogether(
  productId: number,
  query: RecommendationQuery = {},
): Promise<RecommendationItem[]> {
  return listRecommendations(
    `/recommendations/products/${productId}/frequently-bought-together${buildQueryString(query)}`,
  );
}
