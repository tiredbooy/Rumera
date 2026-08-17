"use client";

import { useMemo } from "react";
import { areaY, defineChart, lineY } from "@tanstack/charts";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { scalePoint } from "@tanstack/charts/scales/point";
import { tooltip } from "@tanstack/charts/tooltip";

import { cn } from "@/lib/utils";
import {
  CHART_GOLD,
  faMoneyTick,
  faToman,
  RumeraChart,
  rumeraChartTheme,
  rumeraSvgAnimation,
  usePrefersReducedMotion,
} from "@/lib/charts";

export type RevenuePoint = { day: string; revenue: number };

const CHART_HEIGHT = 256;

/** Persian hover/focus line: day + Toman amount. */
export function formatRevenueTooltip(point: {
  datum: RevenuePoint;
}): string {
  return `${point.datum.day}: ${faToman(point.datum.revenue)}`;
}

export function defineRevenueAreaChart(
  data: readonly RevenuePoint[],
  { animate = true }: { animate?: boolean } = {},
) {
  return defineChart({
    marks: [
      areaY(data, {
        id: "revenue-area",
        x: "day",
        y: "revenue",
        key: "day",
        fill: "url(#revenue-fill)",
        fillOpacity: 1,
      }),
      lineY(data, {
        id: "revenue-line",
        x: "day",
        y: "revenue",
        key: "day",
        stroke: CHART_GOLD,
        strokeWidth: 2,
      }),
    ],
    x: {
      scale: () => scalePoint<string>().padding(0.1),
      axis: {
        ticks: { count: 6 },
        tickLabels: { thin: true, fontSize: 12 },
      },
    },
    y: {
      scale: scaleLinear,
      nice: true,
      grid: true,
      axis: {
        ticks: {
          count: 4,
          format: (value) => faMoneyTick(Number(value)),
        },
        tickLabels: { fontSize: 11 },
      },
    },
    gradients: [
      {
        id: "revenue-fill",
        x1: 0,
        y1: 1,
        x2: 0,
        y2: 0,
        stops: [
          { offset: 0, color: CHART_GOLD, opacity: 0.02 },
          { offset: 1, color: CHART_GOLD, opacity: 0.35 },
        ],
      },
    ],
    clip: true,
    focus: "nearest-x",
    svgAnimation: animate ? rumeraSvgAnimation : false,
    theme: rumeraChartTheme,
    tooltip: {
      use: tooltip,
      format: (point) => formatRevenueTooltip(point),
    },
  });
}

export function RevenueAreaChart({
  data,
  className,
}: {
  data: RevenuePoint[];
  className?: string;
}) {
  const reduced = usePrefersReducedMotion();
  const definition = useMemo(
    () => defineRevenueAreaChart(data, { animate: !reduced }),
    [data, reduced],
  );

  return (
    <RumeraChart
      definition={definition}
      height={CHART_HEIGHT}
      initialWidth={720}
      ariaLabel="روند درآمد روزانه"
      className={cn("h-64", className)}
    />
  );
}
