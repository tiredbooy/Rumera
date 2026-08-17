"use client";

import * as React from "react";
import { barY, defineChart } from "@tanstack/charts";
import { scaleBand } from "@tanstack/charts/scales/band";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { tooltip } from "@tanstack/charts/tooltip";

import { cn } from "@/lib/utils";
import {
  CHART_BLUE,
  faNum,
  faTick,
  RumeraChart,
  rumeraChartTheme,
  rumeraSvgAnimation,
  usePrefersReducedMotion,
} from "@/lib/charts";

export type OrdersBarPoint = { day: string; orders: number };

export function formatOrdersTooltip(day: string, orders: number): string {
  return `${day}: ${faNum(orders)} سفارش`;
}

export function OrdersBarChart({
  data,
  className,
}: {
  data: OrdersBarPoint[];
  className?: string;
}) {
  const reduced = usePrefersReducedMotion();
  const definition = React.useMemo(
    () =>
      defineChart({
        marks: [
          barY(data, {
            id: "orders",
            x: "day",
            y: "orders",
            key: "day",
            fill: CHART_BLUE,
            radius: 6,
            inset: 2,
          }),
        ],
        x: {
          scale: () =>
            scaleBand<string>()
              .domain(data.map((row) => row.day))
              .padding(0.2),
          grid: false,
          axis: { ticks: { size: 0 } },
        },
        y: {
          scale: scaleLinear,
          nice: true,
          grid: true,
          axis: {
            ticks: { format: (value) => faTick(Number(value)) },
          },
        },
        tooltip: {
          use: tooltip,
          format: (point) =>
            formatOrdersTooltip(point.datum.day, point.datum.orders),
        },
        svgAnimation: reduced ? false : rumeraSvgAnimation,
        theme: rumeraChartTheme,
      }),
    [data, reduced],
  );

  return (
    <RumeraChart
      definition={definition}
      ariaLabel="روند سفارش‌ها"
      className={cn("aspect-auto h-64 w-full", className)}
      height={256}
      initialWidth={640}
    />
  );
}
