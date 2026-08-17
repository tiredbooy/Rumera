import { faNum } from "@/lib/products";
import { ChartCard } from "./Charts";
import { DonutChart, DonutLegend } from "./dynamic-charts";
import { fetchRevenueToday } from "@/features/analytics/api";
import type { DailyRevenueStats } from "@/features/analytics/types";

import { can } from "@/lib/rbac/can";
import { PERMISSIONS, type Permission } from "@/lib/rbac/permissions";

import { AnalyticsErrorState } from "./AnalyticsErrorState";

export async function OrderStatusSection({
  permissions,
}: {
  permissions: Permission[];
}) {
  if (!can({ permissions }, PERMISSIONS.ANALYTICS_READ)) return null;

  let today: DailyRevenueStats | null = null;
  let failed = false;
  try {
    today = await fetchRevenueToday();
  } catch {
    failed = true;
  }

  if (failed) {
    return (
      <ChartCard title="سفارش‌ها بر اساس وضعیت" description="—">
        <AnalyticsErrorState className="h-48">
          خطا در دریافت اطلاعات
        </AnalyticsErrorState>
      </ChartCard>
    );
  }

  if (!today) {
    return (
      <ChartCard title="سفارش‌ها بر اساس وضعیت" description="—">
        <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
          آمار امروز هنوز ثبت نشده است.
        </div>
      </ChartCard>
    );
  }

  const ordersByStatus = [
    { label: "تکمیل شده", value: today.orders_completed },
    { label: "لغو شده", value: today.orders_cancelled },
    { label: "عودت", value: today.orders_refunded },
  ];

  if (today.orders_total === 0) {
    return (
      <ChartCard title="سفارش‌ها بر اساس وضعیت" description="۰ سفارش">
        <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
          سفارشی برای امروز ثبت نشده است.
        </div>
      </ChartCard>
    );
  }

  return (
    <ChartCard
      title="سفارش‌ها بر اساس وضعیت"
      description={`${faNum(today.orders_total)} سفارش`}
    >
      <DonutChart
        data={ordersByStatus}
        centerValue={faNum(today.orders_total)}
        centerLabel="سفارش"
      />
      <div className="mt-4">
        <DonutLegend data={ordersByStatus} />
      </div>
    </ChartCard>
  );
}
