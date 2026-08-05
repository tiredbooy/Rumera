import { Suspense } from "react";
import { PageHeader } from "@/features/dashboard/components/page-header";
import { windowFor, isValidRange, type RangeId } from "@/features/analytics/range";
import { RangeToggle } from "./RangeToggle";
import { AnalyticsKpis } from "./AnalyticsKpis";
import { AnalyticsRevenueCharts } from "./AnalyticsRevenueCharts";
import { AnalyticsTopProducts } from "./AnalyticsTopProducts";
import { AnalyticsSearchTerms } from "./AnalyticsSearchTerms";
import { AnalyticsEventBreakdown } from "./AnalyticsEventBreakdown";
import { KpiSkeleton, ChartsSkeleton } from "./skeleton";

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { range: rangeParam } = await searchParams;
  const range: RangeId = isValidRange(rangeParam) ? rangeParam : "30d";
  const { from, to } = windowFor(range);

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

        <div className="grid gap-4 lg:grid-cols-2">
          <Suspense
            key={`top-products-${range}`}
            fallback={<ChartsSkeleton count={1} />}
          >
            <AnalyticsTopProducts from={from} to={to} />
          </Suspense>
          <Suspense
            key={`events-${range}`}
            fallback={<ChartsSkeleton count={1} />}
          >
            <AnalyticsEventBreakdown from={from} to={to} />
          </Suspense>
        </div>

        <Suspense
          key={`search-${range}`}
          fallback={<ChartsSkeleton count={1} />}
        >
          <AnalyticsSearchTerms from={from} to={to} />
        </Suspense>
      </div>
    </>
  );
}
