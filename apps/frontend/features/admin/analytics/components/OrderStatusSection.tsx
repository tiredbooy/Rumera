import { faNum } from "@/lib/products";
import { ChartCard, DonutChart, DonutLegend } from "./Charts";
import { fetchRevenueToday } from "@/features/analytics/api";
import type { DailyRevenueStats } from "@/features/analytics/types";

export async function OrderStatusSection() {
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
        <div className="flex h-48 items-center justify-center text-sm text-destructive">
          خطا در دریافت اطلاعات
        </div>
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
