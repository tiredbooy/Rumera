import { Suspense } from "react";
import { PageHeader } from "@/features/dashboard/components/page-header";
import { RangeToggle } from "./RangeToggle";
import { AnalyticsKpis } from "./AnalyticsKpis";
import { AnalyticsRevenueCharts } from "./AnalyticsRevenueCharts";
import { AnalyticsTopProducts } from "./AnalyticsTopProducts";
import { KpiSkeleton, ChartsSkeleton } from "./skeleton";
import { isValidRange, type RangeId } from "../analytics-range";

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { range: rangeParam } = await searchParams;
  const range: RangeId = isValidRange(rangeParam) ? rangeParam : "30d";

  return (
    <>
      <PageHeader
        title="تحلیل‌ها"
        description="عملکرد فروشگاه در بازه‌های زمانی مختلف."
      />
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">بازهٔ نمایش</p>
          <RangeToggle current={range} />
        </div>

        <Suspense key={`kpis-${range}`} fallback={<KpiSkeleton />}>
          <AnalyticsKpis range={range} />
        </Suspense>

        <Suspense key={`charts-${range}`} fallback={<ChartsSkeleton />}>
          <AnalyticsRevenueCharts range={range} />
        </Suspense>

        <Suspense fallback={<ChartsSkeleton count={1} />}>
          <AnalyticsTopProducts />
        </Suspense>
      </div>
    </>
  );
}
