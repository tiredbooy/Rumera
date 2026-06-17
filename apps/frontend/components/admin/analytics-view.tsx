"use client"

import * as React from "react"

import { formatPrice, categoryFa } from "@/lib/products"
import {
  revenueSeries,
  ordersByStatus,
  categoryShare,
  funnel,
  newVsReturning,
  topProducts,
} from "@/lib/admin/data"
import {
  ChartCard,
  RevenueAreaChart,
  OrdersBarChart,
  DonutChart,
  DonutLegend,
  HorizontalBars,
} from "@/components/admin/charts"

const RANGES = [
  { id: "7d", label: "۷ روز", take: 4 },
  { id: "30d", label: "۳۰ روز", take: 15 },
  { id: "90d", label: "۹۰ روز", take: 15 },
] as const

/** Interactive analytics board: a shared range toggle drives the time-series cards. */
export function AnalyticsView() {
  const [range, setRange] = React.useState<(typeof RANGES)[number]["id"]>("30d")
  const take = RANGES.find((r) => r.id === range)!.take
  const series = revenueSeries.slice(-take)

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
  )

  const funnelData = funnel.map((f) => ({ label: f.stage, value: f.value }))
  const topData = topProducts.map((t) => ({ label: t.product.name, value: t.revenue }))
  const categoryData = categoryShare.map((c) => ({ label: categoryFa[c.category], value: c.value }))

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="روند درآمد" description="تومان" action={rangeToggle}>
          <RevenueAreaChart data={series} />
        </ChartCard>
        <ChartCard title="روند سفارش‌ها" description="تعداد سفارش">
          <OrdersBarChart data={series} />
        </ChartCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <ChartCard title="سهم دسته‌بندی‌ها" description="درصد از فروش">
          <DonutChart data={categoryData} />
          <div className="mt-4">
            <DonutLegend data={categoryData} unit="٪" />
          </div>
        </ChartCard>

        <ChartCard title="مشتری جدید در برابر بازگشتی" description="درصد سفارش‌ها">
          <DonutChart
            data={newVsReturning}
            centerValue="٪۶۲"
            centerLabel="بازگشتی"
          />
          <div className="mt-4">
            <DonutLegend data={newVsReturning} unit="٪" />
          </div>
        </ChartCard>

        <ChartCard title="وضعیت سفارش‌ها" description="تعداد در هر مرحله">
          <div className="pt-2">
            <HorizontalBars
              data={ordersByStatus.map((o) => ({ label: o.label, value: o.value }))}
              color="oklch(0.62 0.16 250)"
            />
          </div>
        </ChartCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="قیف فروش" description="از بازدید تا خرید">
          <HorizontalBars data={funnelData} color="oklch(0.72 0.15 75)" />
        </ChartCard>
        <ChartCard title="پرفروش‌ترین محصولات" description="بر اساس درآمد">
          <HorizontalBars
            data={topData}
            color="oklch(0.55 0.18 25)"
            valueFormatter={(v) => formatPrice(v).replace(" تومان", "")}
          />
        </ChartCard>
      </div>
    </div>
  )
}
