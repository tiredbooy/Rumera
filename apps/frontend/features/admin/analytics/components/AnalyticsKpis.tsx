import { Coins, ShoppingCart, Users, Percent } from "lucide-react";
import { formatPrice, faNum } from "@/lib/products";
import { fetchRevenueSummary } from "@/features/analytics/api";
import {
  previousWindowFor,
  windowFor,
  type RangeId,
} from "@/features/analytics/range";
import {
  analyticsNumber,
  analyticsTrend,
} from "@/features/analytics/utils";
import { StatCard } from "@/features/dashboard/components/stat-card";

export async function AnalyticsKpis({ range }: { range: RangeId }) {
  const [summaryResult, prevResult] = await Promise.allSettled([
    fetchRevenueSummary(windowFor(range)),
    fetchRevenueSummary(previousWindowFor(range)),
  ]);

  const s = summaryResult.status === "fulfilled" ? summaryResult.value : null;
  const p = prevResult.status === "fulfilled" ? prevResult.value : null;

  if (!s) {
    return (
      <p className="col-span-full py-6 text-center text-sm text-destructive">
        خطا در دریافت آمار این بازه
      </p>
    );
  }

  const rawConv = analyticsNumber(s.avg_conversion_rate);
  const convPct = rawConv <= 1 ? rawConv * 100 : rawConv;
  const kpiConversion = Number.isFinite(convPct)
    ? `٪${faNum(Math.round(convPct * 10) / 10)}`
    : "—";

  const revTrend = p
    ? analyticsTrend(
        analyticsNumber(s.total_net_revenue),
        analyticsNumber(p.total_net_revenue),
      )
    : undefined;
  const ordTrend = p
    ? analyticsTrend(s.total_orders, p.total_orders)
    : undefined;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label="درآمد خالص"
        value={formatPrice(analyticsNumber(s.total_net_revenue))}
        icon={Coins}
        trend={revTrend}
      />
      <StatCard
        label="سفارش‌ها"
        value={faNum(s.total_orders)}
        icon={ShoppingCart}
        trend={ordTrend}
      />
      <StatCard
        label="مشتریان یکتا"
        value={faNum(s.unique_customers)}
        icon={Users}
      />
      <StatCard label="نرخ تبدیل" value={kpiConversion} icon={Percent} />
    </div>
  );
}
