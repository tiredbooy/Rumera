import { Suspense } from "react";
import { PageHeader } from "@/features/dashboard/components/page-header";
import { RevenueCards } from "@/features/admin/analytics/components/RevenueCards";
import { RevenueChartSection } from "@/features/admin/analytics/components/RevenueChartSection";
import { OrderStatusSection } from "@/features/admin/analytics/components/OrderStatusSection";
import { RecentOrdersTable } from "@/features/admin/analytics/components/RecentOrdersTable";
import { LowStockList } from "@/features/admin/analytics/components/LowStockList";
import {
  StatCardSkeleton,
  ChartSkeleton,
  TableSkeleton,
  ListSkeleton,
} from "@/features/admin/analytics/components/skeleton";

export default function AdminDashboard() {
  return (
    <>
      <PageHeader
        title="داشبورد"
        description="نمای کلی عملکرد فروشگاه در یک نگاه."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Suspense fallback={<StatCardSkeleton count={4} />}>
          <RevenueCards />
        </Suspense>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Suspense fallback={<ChartSkeleton className="lg:col-span-2" />}>
          <RevenueChartSection />
        </Suspense>
        <Suspense fallback={<ChartSkeleton />}>
          <OrderStatusSection />
        </Suspense>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Suspense fallback={<TableSkeleton rows={5} />}>
            <RecentOrdersTable />
          </Suspense>
        </div>
        <div>
          <Suspense fallback={<ListSkeleton rows={3} />}>
            <LowStockList />
          </Suspense>
        </div>
      </div>
    </>
  );
}
