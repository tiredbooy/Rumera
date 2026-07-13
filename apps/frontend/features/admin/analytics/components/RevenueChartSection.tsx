import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChartCard, RevenueAreaChart } from "./Charts";
import { fetchRevenueTimeSeries } from "@/features/analytics/api";
import { windowFor } from "@/features/analytics/range";
import {
  analyticsNumber,
  shortAnalyticsDay,
} from "@/features/analytics/utils";
import type { DailyRevenueStats } from "@/features/analytics/types";

export async function RevenueChartSection() {
  let series: DailyRevenueStats[] = [];
  let failed = false;
  try {
    series = await fetchRevenueTimeSeries(windowFor("30d"));
  } catch {
    failed = true;
  }

  const chartData = series.map((point) => ({
    day: shortAnalyticsDay(point.date),
    revenue: analyticsNumber(point.net_revenue),
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
      {failed ? (
        <div className="flex h-64 items-center justify-center text-sm text-destructive">
          خطا در دریافت روند درآمد
        </div>
      ) : chartData.length > 0 ? (
        <RevenueAreaChart data={chartData} />
      ) : (
        <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
          داده‌ای برای ۳۰ روز اخیر ثبت نشده است.
        </div>
      )}
    </ChartCard>
  );
}
