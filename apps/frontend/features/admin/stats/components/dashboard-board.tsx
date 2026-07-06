"use client";

import * as React from "react";
import Link from "next/link";
import {
  Coins,
  ShoppingCart,
  Users,
  TrendingUp,
  ArrowLeft,
  Boxes,
} from "lucide-react";

import { formatPrice, faNum } from "@/lib/products";
import { faDate } from "@/lib/catalog/labels";
import type { OrderStatus, OrderListItem } from "@/lib/catalog/types";
import {
  dashboardSummary,
  revenueSeries,
  ordersByStatus,
  recentOrders,
  lowStock,
  type FulfilmentStatus,
  type StockStatus,
} from "@/lib/admin/data";
import {
  getRevenueToday,
  getRevenueTimeSeries,
  listOrders,
  getLowStockInventory,
  type DailyRevenueStat,
  type AdminInventoryRow,
} from "@/lib/api/admin-client";
import { num, trendOf, shortDay } from "@/lib/admin/stats-format";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatCard } from "@/features/dashboard/components/stat-card";
import { OrderStatusBadge, StockBadge } from "@/components/admin/status-badge";
import {
  ChartCard,
  RevenueAreaChart,
  DonutChart,
  DonutLegend,
} from "@/features/admin/stats/components/charts";

const DAY_MS = 86_400_000;

// Sample fulfilment → backend OrderStatus, for the fallback rows only.
const FULFIL_TO_STATUS: Record<FulfilmentStatus, OrderStatus> = {
  processing: "processing",
  packed: "ready_to_ship",
  shipped: "shipped",
  delivered: "delivered",
  cancelled: "cancelled",
};

type RecentRow = {
  id: number;
  created_at: string;
  total: number;
  status: OrderStatus;
};
type LowRow = {
  key: string;
  label: string;
  available: number;
  status: StockStatus;
};

/**
 * Live admin dashboard. KPI cards + the revenue trend come from the analytics
 * API (`/admin/analytics/revenue/{today,timeseries}`), recent orders from
 * `/admin/orders`, and low-stock from `/admin/inventory/low-stock`, all through
 * the authenticated BFF proxy. Error-safe like `analytics-view`: it renders the
 * curated sample set immediately and on any failed fetch, so nothing ever shows
 * empty. The orders-by-status donut has no aggregation endpoint yet, so it stays
 * sample data, marked «نمونه».
 */
export function DashboardBoard() {
  const [today, setToday] = React.useState<DailyRevenueStat | null>(null);
  const [series, setSeries] = React.useState<DailyRevenueStat[] | null>(null);
  const [orders, setOrders] = React.useState<OrderListItem[] | null>(null);
  const [low, setLow] = React.useState<AdminInventoryRow[] | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    const to = new Date();
    const from = new Date(to.getTime() - 30 * DAY_MS);

    getRevenueToday()
      .then((r) => !cancelled && setToday(r))
      .catch(() => !cancelled && setToday(null));
    getRevenueTimeSeries({ from: from.toISOString(), to: to.toISOString() })
      .then((rows) => !cancelled && setSeries(rows ?? []))
      .catch(() => !cancelled && setSeries(null));
    listOrders({ limit: 5, sortBy: "created_at", orderBy: "desc" })
      .then((page) => !cancelled && setOrders(page?.results ?? []))
      .catch(() => !cancelled && setOrders(null));
    getLowStockInventory()
      .then((rows) => !cancelled && setLow(rows ?? []))
      .catch(() => !cancelled && setLow(null));

    return () => {
      cancelled = true;
    };
  }, []);

  const s = dashboardSummary;

  // ── KPI cards (today) ───────────────────────────────────────────────────────
  const revenue = today ? num(today.net_revenue) : s.revenueToday;
  const ordersToday = today ? today.orders_total : s.ordersToday;
  const newCust = today ? today.orders_new_customers : s.newCustomers;
  const aov = today ? num(today.avg_order_value) : s.avgOrderValue;

  // Today-vs-yesterday trend from the last two series points (live only).
  const last = series && series.length > 0 ? series[series.length - 1] : null;
  const prev = series && series.length > 1 ? series[series.length - 2] : null;
  const revTrend = today
    ? last && prev
      ? trendOf(num(last.net_revenue), num(prev.net_revenue))
      : undefined
    : { value: s.revenueTodayTrend, positive: true };
  const ordTrend = today
    ? last && prev
      ? trendOf(last.orders_total, prev.orders_total)
      : undefined
    : { value: s.ordersTodayTrend, positive: true };
  const newTrend = today
    ? undefined
    : { value: s.newCustomersTrend, positive: false };
  const aovTrend = today
    ? undefined
    : { value: s.avgOrderValueTrend, positive: true };

  const hasSeries = !!series && series.length > 0;
  const chartData = hasSeries
    ? series!.map((d) => ({
        day: shortDay(d.date),
        revenue: num(d.net_revenue),
      }))
    : revenueSeries;
  const revSpark = hasSeries
    ? series!.slice(-12).map((d) => num(d.net_revenue))
    : revenueSeries.slice(-12).map((d) => d.revenue);
  const orderSpark = hasSeries
    ? series!.slice(-12).map((d) => d.orders_total)
    : revenueSeries.slice(-12).map((d) => d.orders);

  // ── Orders by status (sample — no aggregation endpoint) ─────────────────────
  const totalOrders = ordersByStatus.reduce((a, b) => a + b.value, 0);

  // ── Recent orders ───────────────────────────────────────────────────────────
  const recentRows: RecentRow[] = orders
    ? orders.map((o) => ({
        id: o.id,
        created_at: o.created_at,
        total: o.total_amount,
        status: o.status,
      }))
    : recentOrders.map((o) => ({
        id: o.number,
        created_at: o.date,
        total: o.total,
        status: FULFIL_TO_STATUS[o.fulfilment],
      }));

  // ── Low stock ───────────────────────────────────────────────────────────────
  const lowRows: LowRow[] = low
    ? low.map((r) => ({
        key: String(r.id),
        label: `واریانت #${faNum(r.product_variant_id)}`,
        available: r.available_stock,
        status: r.available_stock <= 0 ? "out" : "low",
      }))
    : lowStock.map((r) => ({
        key: String(r.product.id),
        label: r.product.name,
        available: r.available,
        status: r.status,
      }));

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="درآمد امروز"
          value={formatPrice(revenue)}
          icon={Coins}
          trend={revTrend}
          hint="نسبت به دیروز"
          spark={revSpark}
        />
        <StatCard
          label="سفارش‌های امروز"
          value={faNum(ordersToday)}
          icon={ShoppingCart}
          trend={ordTrend}
          hint="نسبت به دیروز"
          spark={orderSpark}
        />
        <StatCard
          label="مشتریان جدید"
          value={faNum(newCust)}
          icon={Users}
          trend={newTrend}
          hint="امروز"
        />
        <StatCard
          label="میانگین سبد"
          value={formatPrice(aov)}
          icon={TrendingUp}
          trend={aovTrend}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <ChartCard
          title="روند درآمد"
          description="۳۰ روز اخیر — تومان"
          className="lg:col-span-2"
          action={
            <Button variant="ghost" size="sm" asChild>
              <Link href="/admin/analytics">
                تحلیل کامل <ArrowLeft className="size-4" />
              </Link>
            </Button>
          }
        >
          <RevenueAreaChart data={chartData} />
        </ChartCard>

        <ChartCard
          title="سفارش‌ها بر اساس وضعیت"
          description={`${faNum(totalOrders)} سفارش · نمونه`}
        >
          <DonutChart
            data={ordersByStatus}
            centerValue={faNum(totalOrders)}
            centerLabel="سفارش"
          />
          <div className="mt-4">
            <DonutLegend data={ordersByStatus} />
          </div>
        </ChartCard>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-serif text-lg">سفارش‌های اخیر</h2>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-muted-foreground"
              asChild
            >
              <Link href="/admin/orders">
                مشاهدهٔ همه <ArrowLeft className="size-4" />
              </Link>
            </Button>
          </div>
          <div className="border-hairline overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/[0.04]">
            <Table>
              <TableHeader>
                <TableRow className="border-border/60 bg-muted/30 hover:bg-muted/30">
                  <TableHead className="h-10 text-xs font-medium text-muted-foreground">
                    شماره
                  </TableHead>
                  <TableHead className="h-10 text-xs font-medium text-muted-foreground">
                    تاریخ
                  </TableHead>
                  <TableHead className="h-10 text-xs font-medium text-muted-foreground">
                    مبلغ
                  </TableHead>
                  <TableHead className="h-10 text-xs font-medium text-muted-foreground">
                    وضعیت
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentRows.map((o) => (
                  <TableRow key={o.id} className="border-border/40">
                    <TableCell className="font-medium tabular-nums" dir="ltr">
                      #{faNum(o.id)}
                    </TableCell>
                    <TableCell className="text-muted-foreground" dir="ltr">
                      {faDate(o.created_at)}
                    </TableCell>
                    <TableCell className="font-medium tabular-nums">
                      {formatPrice(o.total)}
                    </TableCell>
                    <TableCell>
                      <OrderStatusBadge status={o.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-serif text-lg">موجودی رو به اتمام</h2>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-muted-foreground"
              asChild
            >
              <Link href="/admin/inventory">
                <Boxes className="size-4" /> انبار
              </Link>
            </Button>
          </div>
          <div className="border-hairline divide-y divide-border/50 overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/[0.04]">
            {lowRows.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">
                موجودی همهٔ کالاها سالم است.
              </p>
            ) : (
              lowRows.map((r) => (
                <div
                  key={r.key}
                  className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/30"
                >
                  <div className="min-w-0 flex-1 leading-tight">
                    <p className="truncate text-sm font-medium">{r.label}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      موجودی قابل فروش: {faNum(r.available)}
                    </p>
                  </div>
                  <StockBadge status={r.status} />
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}
