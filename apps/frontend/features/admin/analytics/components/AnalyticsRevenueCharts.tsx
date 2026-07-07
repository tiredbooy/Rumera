import { fetchRevenueTimeSeries } from "../api";
import { windowFor, type RangeId } from "../analytics-range";
import { shortDay, num } from "@/lib/admin/stats-format";
import { ChartCard, RevenueAreaChart, OrdersBarChart } from "./Charts";

export async function AnalyticsRevenueCharts({ range }: { range: RangeId }) {
  const series = await fetchRevenueTimeSeries(windowFor(range)).catch(
    () => null,
  );
  const chartData = (series ?? []).map((d) => ({
    day: shortDay(d.date),
    revenue: num(d.net_revenue),
    orders: d.orders_count ?? 0,
  }));
  const empty = chartData.length === 0;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <ChartCard title="روند درآمد" description="تومان">
        {empty ? <EmptyState /> : <RevenueAreaChart data={chartData} />}
      </ChartCard>
      <ChartCard title="روند سفارش‌ها" description="تعداد سفارش">
        {empty ? <EmptyState /> : <OrdersBarChart data={chartData} />}
      </ChartCard>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
      داده‌ای موجود نیست.
    </div>
  );
}
