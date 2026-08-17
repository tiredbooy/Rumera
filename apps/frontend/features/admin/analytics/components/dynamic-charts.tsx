"use client";

import dynamic from "next/dynamic";

import type { DonutSlice } from "./DonutChart";
import type { RankingBar } from "./HorizontalBars";
import type { OrdersBarPoint } from "./OrdersBarChart";
import type { RevenuePoint } from "./RevenueAreaChart";

function PlotFallback({ className }: { className: string }) {
  return <div className={className} aria-hidden />;
}

/** Client-only — keeps `@tanstack/charts` out of the RSC graph. */
export const RevenueAreaChart = dynamic<
  { data: RevenuePoint[]; className?: string }
>(() => import("./RevenueAreaChart").then((m) => m.RevenueAreaChart), {
  ssr: false,
  loading: () => <PlotFallback className="h-64 w-full" />,
});

export const OrdersBarChart = dynamic<
  { data: OrdersBarPoint[]; className?: string }
>(() => import("./OrdersBarChart").then((m) => m.OrdersBarChart), {
  ssr: false,
  loading: () => <PlotFallback className="h-64 w-full" />,
});

export const DonutChart = dynamic<{
  data: DonutSlice[];
  className?: string;
  centerLabel?: string;
  centerValue?: string;
}>(() => import("./DonutChart").then((m) => m.DonutChart), {
  ssr: false,
  loading: () => (
    <PlotFallback className="mx-auto aspect-square h-56 w-56" />
  ),
});

export const DonutLegend = dynamic<{
  data: DonutSlice[];
  unit?: string;
}>(() => import("./DonutChart").then((m) => m.DonutLegend), {
  ssr: false,
});

export const HorizontalBars = dynamic<{
  data: RankingBar[];
  className?: string;
  color?: string;
  valueFormatter?: (value: number) => string;
  ariaLabel?: string;
}>(() => import("./HorizontalBars").then((m) => m.HorizontalBars), {
  ssr: false,
  loading: () => <PlotFallback className="min-h-40 w-full" />,
});
