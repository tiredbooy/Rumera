import { fetchRevenueTimeSeries } from "@/features/analytics/api";
import { windowFor, type RangeId } from "@/features/analytics/range";
import {
  analyticsNumber,
  shortAnalyticsDay,
} from "@/features/analytics/utils";
import type { DailyRevenueStats } from "@/features/analytics/types";
import { ChartCard, RevenueAreaChart, OrdersBarChart } from "./Charts";
import { AnalyticsErrorState } from "./AnalyticsErrorState";

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
          <AnalyticsErrorState className="h-64">
            خطا در دریافت روند درآمد
          </AnalyticsErrorState>
        ) : chartData.length === 0 ? (
          <AnalyticsState>داده‌ای برای این بازه ثبت نشده است.</AnalyticsState>
        ) : (
          <RevenueAreaChart data={chartData} />
        )}
      </ChartCard>
      <ChartCard title="روند سفارش‌ها" description="تعداد سفارش">
        {failed ? (
          <AnalyticsErrorState className="h-64">
            خطا در دریافت روند سفارش‌ها
          </AnalyticsErrorState>
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
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}
