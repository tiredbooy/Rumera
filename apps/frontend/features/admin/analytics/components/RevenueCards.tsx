import { Coins, ShoppingCart, Users, TrendingUp } from "lucide-react";
import { formatPrice, faNum } from "@/lib/products";
import { StatCard } from "@/features/dashboard/components/stat-card";
import { fetchRevenueToday } from "../api";

export async function RevenueCards() {
  const today = await fetchRevenueToday().catch(() => null);

  if (!today) {
    return (
      <p className="col-span-full py-6 text-center text-sm text-destructive">
        خطا در دریافت آمار امروز
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
