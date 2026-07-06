"use client";

import * as React from "react";
import { Coins, ShoppingCart, Users, Percent } from "lucide-react";

import { formatPrice, faNum, categoryFa } from "@/lib/products";
import {
  revenueSeries,
  ordersByStatus,
  categoryShare,
  funnel,
  newVsReturning,
  topProducts,
  dashboardSummary,
} from "@/lib/admin/data";
import {
  getRevenueSummary,
  getRevenueTimeSeries,
  type RevenueSummary,
  type DailyRevenueStat,
} from "@/lib/api/admin-client";
import { num, sumBy, trendOf, shortDay } from "@/lib/admin/stats-format";
import { StatCard } from "@/features/dashboard/components/stat-card";
import {
  ChartCard,
  RevenueAreaChart,
  OrdersBarChart,
  DonutChart,
  DonutLegend,
  HorizontalBars,
} from "@/features/admin/stats/components/charts";

const RANGES = [
  { id: "7d", label: "۷ روز", days: 7 },
  { id: "30d", label: "۳۰ روز", days: 30 },
  { id: "90d", label: "۹۰ روز", days: 90 },
] as const;

type RangeId = (typeof RANGES)[number]["id"];

const DAY_MS = 86_400_000;

/**
 * Live analytics board. KPI cards + the revenue/orders/new-vs-returning charts
 * are backed by the admin analytics API (`/admin/analytics/revenue/*`) through
 * the authenticated BFF proxy, with the shared range toggle driving the window.
 *
 * It stays error-safe like the storefront fetchers: it renders the curated
 * sample dataset immediately and on any fetch failure, so the board never shows
 * an empty/broken state. Charts that the backend can't yet label-join or doesn't
 * expose an endpoint for (category share, top products, sales funnel, fulfilment
 * buckets) keep the sample data and are marked «نمونه» until those land.
 */
export function AnalyticsView() {
  const [range, setRange] = React.useState<RangeId>("30d");
  // 90 days of real daily stats, fetched once; the toggle slices this client-side.
  const [series, setSeries] = React.useState<DailyRevenueStat[] | null>(null);
  // Range-scoped KPI summary, refetched when the toggle changes.
  const [summary, setSummary] = React.useState<RevenueSummary | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    const to = new Date();
    const from = new Date(to.getTime() - 90 * DAY_MS);
    getRevenueTimeSeries({ from: from.toISOString(), to: to.toISOString() })
      .then((rows) => {
        if (!cancelled) setSeries(rows ?? []);
      })
      .catch(() => {
        if (!cancelled) setSeries(null); // keep the sample fallback
      });
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    const days = RANGES.find((r) => r.id === range)!.days;
    const to = new Date();
    const from = new Date(to.getTime() - days * DAY_MS);
    getRevenueSummary({ from: from.toISOString(), to: to.toISOString() })
      .then((s) => {
        if (!cancelled) setSummary(s);
      })
      .catch(() => {
        if (!cancelled) setSummary(null);
      });
    return () => {
      cancelled = true;
    };
  }, [range]);

  const days = RANGES.find((r) => r.id === range)!.days;
  const realWindow = series ? series.slice(-days) : null;
  const hasReal = !!realWindow && realWindow.length > 0;

  // ── KPI cards ──────────────────────────────────────────────────────────────
  const kpiRevenue = summary
    ? num(summary.total_net_revenue)
    : dashboardSummary.revenue30d;
  const kpiOrders = summary ? summary.total_orders : dashboardSummary.orders30d;
  const kpiCustomers = summary
    ? summary.unique_customers
    : dashboardSummary.activeCustomers;
  const rawConv = summary ? num(summary.avg_conversion_rate) : NaN;
  const convPct = Number.isFinite(rawConv)
    ? rawConv <= 1
      ? rawConv * 100
      : rawConv
    : NaN;
  const kpiConversion = Number.isFinite(convPct)
    ? `٪${faNum(Math.round(convPct * 10) / 10)}`
    : dashboardSummary.conversionRate;

  // Trends: compare the selected window against the equally-sized prior window.
  const prevWindow = series ? series.slice(-2 * days, -days) : null;
  const revTrend =
    hasReal && prevWindow?.length
      ? trendOf(
          sumBy(realWindow!, (d) => num(d.net_revenue)),
          sumBy(prevWindow, (d) => num(d.net_revenue)),
        )
      : undefined;
  const ordTrend =
    hasReal && prevWindow?.length
      ? trendOf(
          sumBy(realWindow!, (d) => d.orders_total),
          sumBy(prevWindow, (d) => d.orders_total),
        )
      : undefined;

  const revSpark = hasReal
    ? realWindow!.slice(-14).map((d) => num(d.net_revenue))
    : revenueSeries.slice(-14).map((d) => d.revenue);
  const orderSpark = hasReal
    ? realWindow!.slice(-14).map((d) => d.orders_total)
    : revenueSeries.slice(-14).map((d) => d.orders);

  // ── Time-series charts ───────────────────────────────────────────────────────
  const chartSeries = hasReal
    ? realWindow!.map((d) => ({
        day: shortDay(d.date),
        revenue: num(d.net_revenue),
        orders: d.orders_total,
      }))
    : revenueSeries.slice(-Math.min(days, revenueSeries.length));

  // ── New vs returning (derived from the real window) ──────────────────────────
  const newSum = hasReal
    ? sumBy(realWindow!, (d) => d.orders_new_customers)
    : 0;
  const retSum = hasReal ? sumBy(realWindow!, (d) => d.orders_returning) : 0;
  const nvrTotal = newSum + retSum;
  const nvrData =
    nvrTotal > 0
      ? [
          { label: "بازگشتی", value: Math.round((retSum / nvrTotal) * 100) },
          { label: "جدید", value: Math.round((newSum / nvrTotal) * 100) },
        ]
      : newVsReturning;
  const retPct = nvrTotal > 0 ? Math.round((retSum / nvrTotal) * 100) : 62;

  // ── Sample-only surfaces (no backend label-join / endpoint yet) ───────────────
  const funnelData = funnel.map((f) => ({ label: f.stage, value: f.value }));
  const topData = topProducts.map((t) => ({
    label: t.product.name,
    value: t.revenue,
  }));
  const categoryData = categoryShare.map((c) => ({
    label: categoryFa[c.category],
    value: c.value,
  }));
  const ordersByStatusData = ordersByStatus.map((o) => ({
    label: o.label,
    value: o.value,
  }));

  const rangeToggle = (
    <div className="inline-flex items-center gap-0.5 rounded-lg border border-border/60 bg-muted/50 p-0.5">
      {RANGES.map((r) => (
        <button
          key={r.id}
          type="button"
          aria-pressed={range === r.id}
          onClick={() => setRange(r.id)}
          className={
            "cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium transition-colors " +
            (range === r.id
              ? "bg-card text-foreground shadow-sm ring-1 ring-foreground/[0.06]"
              : "text-muted-foreground hover:text-foreground")
          }
        >
          {r.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">بازهٔ نمایش</p>
        {rangeToggle}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="درآمد خالص"
          value={formatPrice(kpiRevenue)}
          icon={Coins}
          trend={revTrend}
          spark={revSpark}
        />
        <StatCard
          label="سفارش‌ها"
          value={faNum(kpiOrders)}
          icon={ShoppingCart}
          trend={ordTrend}
          spark={orderSpark}
        />
        <StatCard
          label="مشتریان یکتا"
          value={faNum(kpiCustomers)}
          icon={Users}
        />
        <StatCard label="نرخ تبدیل" value={kpiConversion} icon={Percent} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="روند درآمد" description="تومان">
          <RevenueAreaChart data={chartSeries} />
        </ChartCard>
        <ChartCard title="روند سفارش‌ها" description="تعداد سفارش">
          <OrdersBarChart data={chartSeries} />
        </ChartCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <ChartCard title="سهم دسته‌بندی‌ها" description="درصد از فروش · نمونه">
          <DonutChart data={categoryData} />
          <div className="mt-4">
            <DonutLegend data={categoryData} unit="٪" />
          </div>
        </ChartCard>

        <ChartCard
          title="مشتری جدید در برابر بازگشتی"
          description="درصد سفارش‌ها"
        >
          <DonutChart
            data={nvrData}
            centerValue={`٪${faNum(retPct)}`}
            centerLabel="بازگشتی"
          />
          <div className="mt-4">
            <DonutLegend data={nvrData} unit="٪" />
          </div>
        </ChartCard>

        <ChartCard
          title="وضعیت سفارش‌ها"
          description="تعداد در هر مرحله · نمونه"
        >
          <div className="pt-2">
            <HorizontalBars
              data={ordersByStatusData}
              color="oklch(0.62 0.16 250)"
            />
          </div>
        </ChartCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="قیف فروش" description="از بازدید تا خرید · نمونه">
          <HorizontalBars data={funnelData} color="oklch(0.72 0.15 75)" />
        </ChartCard>
        <ChartCard
          title="پرفروش‌ترین محصولات"
          description="بر اساس درآمد · نمونه"
        >
          <HorizontalBars
            data={topData}
            color="oklch(0.55 0.18 25)"
            valueFormatter={(v) => formatPrice(v).replace(" تومان", "")}
          />
        </ChartCard>
      </div>
    </div>
  );
}
