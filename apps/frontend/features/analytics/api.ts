import "server-only";

import { cache } from "react";

import { ApiError, apiFetch } from "@/lib/api/client";
import { buildQueryString } from "@/lib/utils/api-helpers";

import type {
  AnalyticsDateRange,
  AnalyticsProductId,
  AnalyticsTopQuery,
  DailyProductStats,
  DailyRevenueStats,
  EventBreakdown,
  ProductStatsSummary,
  RevenueStatsSummary,
  SearchTermSummary,
  TopProductEntry,
} from "./types";

// The dashboard renders two independent server components that need this row.
// React cache preserves request deduplication across the render pass.
export const fetchRevenueToday = cache(
  async (): Promise<DailyRevenueStats | null> => {
    try {
      return await apiFetch<DailyRevenueStats>(
        "/admin/analytics/revenue/today",
      );
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  },
);

export function fetchRevenueSummary(
  filter: AnalyticsDateRange = {},
): Promise<RevenueStatsSummary> {
  return apiFetch<RevenueStatsSummary>(
    `/admin/analytics/revenue/summary${buildQueryString(filter)}`,
  );
}

export function fetchRevenueTimeSeries(
  filter: AnalyticsDateRange = {},
): Promise<DailyRevenueStats[]> {
  return apiFetch<DailyRevenueStats[]>(
    `/admin/analytics/revenue/timeseries${buildQueryString(filter)}`,
  );
}

export function fetchTopProductsByRevenue(
  query: AnalyticsTopQuery = {},
): Promise<TopProductEntry[]> {
  return apiFetch<TopProductEntry[]>(
    `/admin/analytics/products/top-revenue${buildQueryString(query)}`,
  );
}

export function fetchTopProductsByViews(
  query: AnalyticsTopQuery = {},
): Promise<TopProductEntry[]> {
  return apiFetch<TopProductEntry[]>(
    `/admin/analytics/products/top-views${buildQueryString(query)}`,
  );
}

export function fetchProductStatsSummary(
  productId: AnalyticsProductId,
  filter: AnalyticsDateRange = {},
): Promise<ProductStatsSummary> {
  return apiFetch<ProductStatsSummary>(
    `/admin/analytics/products/${encodeURIComponent(productId)}/summary${buildQueryString(filter)}`,
  );
}

export function fetchProductStatsTimeSeries(
  productId: AnalyticsProductId,
  filter: AnalyticsDateRange = {},
): Promise<DailyProductStats[]> {
  return apiFetch<DailyProductStats[]>(
    `/admin/analytics/products/${encodeURIComponent(productId)}/timeseries${buildQueryString(filter)}`,
  );
}

export function fetchTopSearchTerms(
  query: AnalyticsTopQuery = {},
): Promise<SearchTermSummary[]> {
  return apiFetch<SearchTermSummary[]>(
    `/admin/analytics/search/top-terms${buildQueryString(query)}`,
  );
}

export function fetchZeroResultSearchTerms(
  query: AnalyticsTopQuery = {},
): Promise<SearchTermSummary[]> {
  return apiFetch<SearchTermSummary[]>(
    `/admin/analytics/search/zero-result${buildQueryString(query)}`,
  );
}

export function fetchTopConvertingSearchTerms(
  query: AnalyticsTopQuery = {},
): Promise<SearchTermSummary[]> {
  return apiFetch<SearchTermSummary[]>(
    `/admin/analytics/search/top-converting${buildQueryString(query)}`,
  );
}

export function fetchEventBreakdown(
  filter: AnalyticsDateRange = {},
): Promise<EventBreakdown> {
  return apiFetch<EventBreakdown>(
    `/admin/analytics/events/breakdown${buildQueryString(filter)}`,
  );
}
