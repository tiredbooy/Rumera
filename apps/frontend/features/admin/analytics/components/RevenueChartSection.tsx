import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChartCard, RevenueAreaChart } from "./Charts";
import { fetchRevenueTimeSeries } from "../api";
import { windowFor } from "../analytics-range";
import { num, shortDay } from "@/lib/admin/stats-format";

export async function RevenueChartSection() {
  const series = await fetchRevenueTimeSeries(windowFor("30d"))?.catch(
    () => null,
  );
  const chartData = (series ?? [])?.map?.((p) => ({
    day: shortDay(p.date),
    revenue: num(p.net_revenue),
  }));

  return (
    <ChartCard
      title="روند درآمد"
      description="۳۰ روز اخیر — تومان"
      className="lg:col-span-2"
      action={
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/analytics">
            تحلیل کامل <ArrowLeft className="size-4" />
          </Link>
        </Button>
      }
    >
      {chartData?.length > 0 ? (
        <RevenueAreaChart data={chartData} />
      ) : (
        <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
          داده‌ای برای نمایش وجود ندارد.
        </div>
      )}
    </ChartCard>
  );
}
