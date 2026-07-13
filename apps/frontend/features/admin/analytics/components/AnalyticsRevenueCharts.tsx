import { fetchRevenueTimeSeries } from "@/features/analytics/api";
import { windowFor, type RangeId } from "@/features/analytics/range";
import {
  analyticsNumber,
  shortAnalyticsDay,
} from "@/features/analytics/utils";
import type { DailyRevenueStats } from "@/features/analytics/types";
import { ChartCard, RevenueAreaChart, OrdersBarChart } from "./Charts";

export async function AnalyticsRevenueCharts({ range }: { range: RangeId }) {
  let series: DailyRevenueStats[] = [];
  let failed = false;
  try {
    series = await fetchRevenueTimeSeries(windowFor(range));
  } catch {
    failed = true;
  }

  const chartData = series.map((day) => ({
    day: shortAnalyticsDay(day.date),
    revenue: analyticsNumber(day.net_revenue),
    orders: day.orders_total,
  }));

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <ChartCard title="روند درآمد" description="تومان">
        {failed ? (
          <AnalyticsState error>خطا در دریافت روند درآمد</AnalyticsState>
        ) : chartData.length === 0 ? (
          <AnalyticsState>داده‌ای برای این بازه ثبت نشده است.</AnalyticsState>
        ) : (
          <RevenueAreaChart data={chartData} />
        )}
      </ChartCard>
      <ChartCard title="روند سفارش‌ها" description="تعداد سفارش">
        {failed ? (
          <AnalyticsState error>خطا در دریافت روند سفارش‌ها</AnalyticsState>
        ) : chartData.length === 0 ? (
          <AnalyticsState>داده‌ای برای این بازه ثبت نشده است.</AnalyticsState>
        ) : (
          <OrdersBarChart data={chartData} />
        )}
      </ChartCard>
    </div>
  );
}

function AnalyticsState({
  children,
  error = false,
}: {
  children: React.ReactNode;
  error?: boolean;
}) {
  return (
    <div
      className={`flex h-64 items-center justify-center text-sm ${error ? "text-destructive" : "text-muted-foreground"}`}
    >
      {children}
    </div>
  );
}
