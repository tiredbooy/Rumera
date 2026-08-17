import { Suspense } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/features/dashboard/components/page-header";
import { RecentOrdersTable } from "@/features/admin/analytics/components/RecentOrdersTable";
import { LowStockList } from "@/features/admin/analytics/components/LowStockList";
import {
  TableSkeleton,
  ListSkeleton,
} from "@/features/admin/analytics/components/skeleton";
import {
  AdminWorkQueue,
  AdminWorkQueueSkeleton,
} from "@/features/dashboard/components/admin-work-queue";
import { requireStaff } from "@/lib/auth/session";
import { can } from "@/lib/rbac/can";
import { PERMISSIONS } from "@/lib/rbac/permissions";

export default async function AdminDashboard() {
  const session = await requireStaff();
  const { permissions } = session;
  const canAnalytics = can(session, PERMISSIONS.ANALYTICS_READ);
  const canOrders = can(session, PERMISSIONS.ORDERS_READ);
  const canInventory = can(session, PERMISSIONS.INVENTORY_READ);

  return (
    <>
      {/*
        S-1: this page used to open with revenue and then oblige the operator to
        visit four other screens to find out whether anything was waiting. The
        work queue leads now; the revenue reporting it replaced still lives in
        full at /admin/analytics, so nothing was lost — it just stopped being the
        first thing a shift sees.
      */}
      <PageHeader
        title="داشبورد"
        description="کارهای امروز. برای گزارش‌های فروش به «تحلیل‌ها» بروید."
        actions={
          canAnalytics ? (
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/analytics">تحلیل‌ها و گزارش‌ها</Link>
            </Button>
          ) : undefined
        }
      />
      <Suspense fallback={<AdminWorkQueueSkeleton />}>
        <AdminWorkQueue permissions={permissions} />
      </Suspense>
      {canOrders || canInventory ? (
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          {canOrders ? (
            <div className="lg:col-span-2">
              <Suspense fallback={<TableSkeleton rows={5} />}>
                <RecentOrdersTable permissions={permissions} />
              </Suspense>
            </div>
          ) : null}
          {canInventory ? (
            <div>
              <Suspense fallback={<ListSkeleton rows={3} />}>
                <LowStockList permissions={permissions} />
              </Suspense>
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
