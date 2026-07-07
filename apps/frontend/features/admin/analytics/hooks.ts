import { getLowStockInventory, listOrders } from "@/lib/api/admin-client"; // your existing order/inventory fetchers
import { useQuery } from "@tanstack/react-query";
import { fetchRevenueTimeSeries, fetchRevenueToday } from "./api";

// 30‑day window for the chart
function last30DaysFilter() {
  const to = new Date();
  const from = new Date(to.getTime() - 30 * 86_400_000);
  return {
    date_from: from.toISOString().slice(0, 10),
    date_to: to.toISOString().slice(0, 10),
  };
}

export function useDashboard() {
  // Today’s stats
  const todayQuery = useQuery({
    queryKey: ["revenue", "today"],
    queryFn: fetchRevenueToday,
    staleTime: 60_000, // refetch every minute, but cache quickly
  });

  // 30‑day time series for the chart
  const timeSeriesQuery = useQuery({
    queryKey: ["revenue", "timeseries", last30DaysFilter()],
    queryFn: () => fetchRevenueTimeSeries(last30DaysFilter()),
    staleTime: 10 * 60_000, // 10 minutes
  });

  // Recent orders (assuming listOrders exists, use it or create a wrapper)
  const recentOrdersQuery = useQuery({
    queryKey: ["orders", "recent", 10],
    queryFn: () => listOrders({ limit: 10, sortBy: "-created_at" }),
    staleTime: 60_000,
  });

  // Low stock inventory
  const lowStockQuery = useQuery({
    queryKey: ["inventory", "low-stock"],
    queryFn: getLowStockInventory,
    staleTime: 5 * 60_000,
  });

  return {
    today: todayQuery.data,
    timeSeries: timeSeriesQuery.data ?? [],
    recentOrders: recentOrdersQuery.data?.results ?? [],
    lowStockItems: lowStockQuery.data ?? [],
    isLoading:
      todayQuery.isLoading ||
      timeSeriesQuery.isLoading ||
      recentOrdersQuery.isLoading ||
      lowStockQuery.isLoading,
    isError:
      todayQuery.isError ||
      timeSeriesQuery.isError ||
      recentOrdersQuery.isError ||
      lowStockQuery.isError,
  };
}
