import { faNum } from "@/lib/products";
import { ChartCard, DonutChart, DonutLegend } from "./Charts";
import { fetchRevenueToday } from "../api";

export async function OrderStatusSection() {
  const today = await fetchRevenueToday().catch(() => null);

  if (!today) {
    return (
      <ChartCard title="سفارش‌ها بر اساس وضعیت" description="—">
        <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
          خطا در دریافت اطلاعات
        </div>
      </ChartCard>
    );
  }

  const ordersByStatus = [
    { label: "تکمیل شده", value: today.orders_completed },
    { label: "لغو شده", value: today.orders_cancelled },
    { label: "عودت", value: today.orders_refunded },
  ];

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
