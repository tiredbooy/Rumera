import "server-only";
import { cache } from "react";
import { adminRequest } from "@/lib/api/api";
import { buildQueryString } from "@/lib/utils/api-helpers";
import type {
  DailyRevenueStats,
  RevenueStatsSummary,
  RevenueTimeSeriesPoint,
  SearchTermStat,
  EventBreakdownItem,
  RevenueStatsFilter,
  TopProductRevenueEntry,
} from "./types";

// cache(): RevenueCards and OrderStatusSection both call this on the same
// render pass (dashboard page). Without cache(), that's two identical
// network requests; with it, React dedupes to one.
export const fetchRevenueToday = cache(
  (): Promise<DailyRevenueStats> =>
    adminRequest<DailyRevenueStats>("admin/analytics/revenue/today"),
);

export function fetchRevenueSummary(
  filter: RevenueStatsFilter = {},
): Promise<RevenueStatsSummary> {
  return adminRequest<RevenueStatsSummary>(
    `admin/analytics/revenue/summary${buildQueryString(filter)}`,
  );
}

export function fetchRevenueTimeSeries(
  filter: RevenueStatsFilter = {},
): Promise<RevenueTimeSeriesPoint[]> {
  return adminRequest<RevenueTimeSeriesPoint[]>(
    `admin/analytics/revenue/timeseries${buildQueryString(filter)}`,
  );
}

export function fetchTopProductsByRevenue(
  limit?: number,
): Promise<TopProductRevenueEntry[]> {
  return adminRequest<TopProductRevenueEntry[]>(
    `admin/analytics/products/top-revenue${buildQueryString(limit ? { limit } : {})}`,
  );
}

export function fetchTopProductsByViews(
  limit?: number,
): Promise<{ product_id: string; views: number }[]> {
  return adminRequest<{ product_id: string; views: number }[]>(
    `admin/analytics/products/top-views${buildQueryString(limit ? { limit } : {})}`,
  );
}

export function fetchTopSearchTerms(limit?: number): Promise<SearchTermStat[]> {
  return adminRequest<SearchTermStat[]>(
    `admin/analytics/search/top-terms${buildQueryString(limit ? { limit } : {})}`,
  );
}

export function fetchZeroResultSearchTerms(): Promise<SearchTermStat[]> {
  return adminRequest<SearchTermStat[]>("admin/analytics/search/zero-result");
}

export function fetchTopConvertingSearchTerms(): Promise<SearchTermStat[]> {
  return adminRequest<SearchTermStat[]>(
    "admin/analytics/search/top-converting",
  );
}

export function fetchEventBreakdown(): Promise<EventBreakdownItem[]> {
  return adminRequest<EventBreakdownItem[]>("admin/analytics/events/breakdown");
}
