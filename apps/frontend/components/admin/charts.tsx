"use client"

import * as React from "react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts"

import { cn } from "@/lib/utils"
import { faNum } from "@/lib/products"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

/** Brand-aligned series colours (gold = revenue, blue = orders). */
const GOLD = "oklch(0.72 0.15 75)"
const BLUE = "oklch(0.62 0.16 250)"

/** Donut palette — one accent per slice, warm→cool. */
export const SLICE_COLORS = [
  "oklch(0.72 0.15 75)",
  "oklch(0.55 0.18 25)",
  "oklch(0.62 0.16 250)",
  "oklch(0.68 0.14 160)",
  "oklch(0.6 0.16 320)",
  "oklch(0.7 0.13 130)",
  "oklch(0.58 0.05 250)",
]

const faTick = (v: number) => faNum(v)
const faMoneyTick = (v: number) => `${faNum(Math.round(v / 1_000_000))}م`

/** True when the user has asked the OS to minimise motion — gates chart animation. */
function usePrefersReducedMotion() {
  return React.useSyncExternalStore(
    (notify) => {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
      mq.addEventListener("change", notify)
      return () => mq.removeEventListener("change", notify)
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false
  )
}

/** Framed chart panel matching the dashboard card system. */
export function ChartCard({
  title,
  description,
  action,
  className,
  children,
}: {
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "border-hairline rounded-2xl bg-card p-5 ring-1 ring-foreground/5",
        className
      )}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-serif text-lg">{title}</h3>
          {description ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

/* ----------------------------- Revenue (area) ----------------------------- */

export function RevenueAreaChart({
  data,
  className,
}: {
  data: { day: string; revenue: number }[]
  className?: string
}) {
  const reduced = usePrefersReducedMotion()
  const config = {
    revenue: { label: "درآمد (تومان)", color: GOLD },
  } satisfies ChartConfig
  return (
    <ChartContainer config={config} className={cn("aspect-auto h-64 w-full", className)}>
      <AreaChart data={data} margin={{ left: 4, right: 4, top: 8 }}>
        <defs>
          <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={GOLD} stopOpacity={0.35} />
            <stop offset="100%" stopColor={GOLD} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border/50" />
        <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} fontSize={12} />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={36}
          tickMargin={4}
          fontSize={11}
          tickFormatter={faMoneyTick}
        />
        <ChartTooltip
          content={<ChartTooltipContent formatter={(value) => `${faNum(Number(value))} تومان`} />}
        />
        <Area
          dataKey="revenue"
          type="monotone"
          stroke={GOLD}
          strokeWidth={2}
          fill="url(#fillRevenue)"
          isAnimationActive={!reduced}
        />
      </AreaChart>
    </ChartContainer>
  )
}

/* ------------------------------ Orders (bar) ------------------------------ */

export function OrdersBarChart({
  data,
  className,
}: {
  data: { day: string; orders: number }[]
  className?: string
}) {
  const reduced = usePrefersReducedMotion()
  const config = { orders: { label: "سفارش‌ها", color: BLUE } } satisfies ChartConfig
  return (
    <ChartContainer config={config} className={cn("aspect-auto h-64 w-full", className)}>
      <BarChart data={data} margin={{ left: 4, right: 4, top: 8 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border/50" />
        <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} fontSize={12} />
        <YAxis tickLine={false} axisLine={false} width={28} fontSize={11} tickFormatter={faTick} />
        <ChartTooltip
          content={<ChartTooltipContent formatter={(value) => faNum(Number(value))} />}
        />
        <Bar dataKey="orders" fill={BLUE} radius={[6, 6, 0, 0]} isAnimationActive={!reduced} />
      </BarChart>
    </ChartContainer>
  )
}

/* ------------------------------- Donut ------------------------------------ */

export function DonutChart({
  data,
  className,
  centerLabel,
  centerValue,
}: {
  data: { label: string; value: number }[]
  className?: string
  centerLabel?: string
  centerValue?: string
}) {
  const reduced = usePrefersReducedMotion()
  const config: ChartConfig = Object.fromEntries(
    data.map((d, i) => [d.label, { label: d.label, color: SLICE_COLORS[i % SLICE_COLORS.length] }])
  )
  return (
    <ChartContainer config={config} className={cn("mx-auto aspect-square h-56", className)}>
      <PieChart>
        <ChartTooltip
          content={<ChartTooltipContent nameKey="label" formatter={(value) => faNum(Number(value))} />}
        />
        <Pie
          data={data}
          dataKey="value"
          nameKey="label"
          innerRadius={58}
          outerRadius={84}
          paddingAngle={2}
          strokeWidth={2}
          stroke="var(--card)"
          isAnimationActive={!reduced}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={SLICE_COLORS[i % SLICE_COLORS.length]} />
          ))}
        </Pie>
        {centerValue ? (
          <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle">
            <tspan x="50%" dy="-0.2em" className="fill-foreground font-serif text-2xl">
              {centerValue}
            </tspan>
            {centerLabel ? (
              <tspan x="50%" dy="1.6em" className="fill-muted-foreground text-xs">
                {centerLabel}
              </tspan>
            ) : null}
          </text>
        ) : null}
      </PieChart>
    </ChartContainer>
  )
}

/** Coloured legend rows for a donut, with values. */
export function DonutLegend({
  data,
  unit = "",
}: {
  data: { label: string; value: number }[]
  unit?: string
}) {
  return (
    <ul className="flex flex-col gap-2">
      {data.map((d, i) => (
        <li key={d.label} className="flex items-center gap-2 text-sm">
          <span
            className="size-2.5 rounded-full"
            style={{ background: SLICE_COLORS[i % SLICE_COLORS.length] }}
          />
          <span className="text-muted-foreground">{d.label}</span>
          <span className="ms-auto font-medium tabular-nums">
            {faNum(d.value)}
            {unit}
          </span>
        </li>
      ))}
    </ul>
  )
}

/* ----------------------------- Horizontal bars ---------------------------- */

export function HorizontalBars({
  data,
  className,
  color = BLUE,
  valueFormatter = (v: number) => faNum(v),
}: {
  data: { label: string; value: number }[]
  className?: string
  color?: string
  valueFormatter?: (v: number) => string
}) {
  const max = Math.max(...data.map((d) => d.value), 1)
  return (
    <ul className={cn("flex flex-col gap-3", className)}>
      {data.map((d) => (
        <li key={d.label} className="flex items-center gap-3">
          <span className="w-28 shrink-0 truncate text-sm text-muted-foreground">{d.label}</span>
          <span className="relative h-6 flex-1 overflow-hidden rounded-md bg-muted">
            <span
              className="absolute inset-y-0 start-0 rounded-md transition-all"
              style={{ width: `${(d.value / max) * 100}%`, background: color, opacity: 0.85 }}
            />
          </span>
          <span className="w-16 shrink-0 text-end text-sm font-medium tabular-nums">
            {valueFormatter(d.value)}
          </span>
        </li>
      ))}
    </ul>
  )
}
