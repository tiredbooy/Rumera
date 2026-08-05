import "server-only";

import { apiFetch } from "@/lib/api/client";
import type { RecommendationOpsStats } from "./admin-types";

export async function getRecommendationOpsStats(
  windowDays = 30,
): Promise<RecommendationOpsStats> {
  const q = new URLSearchParams({ window_days: String(windowDays) });
  return apiFetch<RecommendationOpsStats>(
    `/admin/recommendations/stats?${q.toString()}`,
  );
}
