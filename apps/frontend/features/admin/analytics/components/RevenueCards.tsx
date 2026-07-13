import { Coins, ShoppingCart, Users, TrendingUp } from "lucide-react";
import { formatPrice, faNum } from "@/lib/products";
import { StatCard } from "@/features/dashboard/components/stat-card";
import { fetchRevenueToday } from "@/features/analytics/api";
import type { DailyRevenueStats } from "@/features/analytics/types";

export async function RevenueCards() {
  let today: DailyRevenueStats | null = null;
  let failed = false;
  try {
    today = await fetchRevenueToday();
  } catch {
    failed = true;
  }

  if (failed) {
    return (
      <p className="col-span-full py-6 text-center text-sm text-destructive">
        خطا در دریافت آمار امروز
      </p>
    );
  }

  if (!today) {
    return (
      <p className="col-span-full py-6 text-center text-sm text-muted-foreground">
        آمار امروز هنوز ثبت نشده است.
      </p>
    );
  }

  return (
    <>
      <StatCard
        label="درآمد امروز"
        value={formatPrice(Number(today.net_revenue))}
        icon={Coins}
        hint="امروز"
      />
      <StatCard
        label="سفارش‌های امروز"
        value={faNum(today.orders_total)}
        icon={ShoppingCart}
        hint="امروز"
      />
      <StatCard
        label="مشتریان جدید"
        value={faNum(today.orders_new_customers)}
        icon={Users}
        hint="امروز"
      />
      <StatCard
        label="میانگین سبد"
        value={formatPrice(Number(today.avg_order_value))}
        icon={TrendingUp}
      />
    </>
  );
}
