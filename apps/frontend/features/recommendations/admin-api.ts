import "server-only";

import { apiFetch } from "@/lib/api/client";
import { publicRequest } from "@/lib/api/public";
import { buildQueryString } from "@/lib/utils/api-helpers";
import type { RecommendationOpsStats } from "./admin-types";
import type { RecommendationItem, RecommendationQuery } from "./types";

export async function getRecommendationOpsStats(
  windowDays = 30,
): Promise<RecommendationOpsStats> {
  const q = new URLSearchParams({ window_days: String(windowDays) });
  return apiFetch<RecommendationOpsStats>(
    `/admin/recommendations/stats?${q.toString()}`,
  );
}

/** Live trending sample. Throws — admin must not treat a miss as empty. */
export function getTrending(
  query: RecommendationQuery = {},
): Promise<RecommendationItem[]> {
  return publicRequest<RecommendationItem[]>(
    `/recommendations/trending${buildQueryString(query)}`,
  );
}
