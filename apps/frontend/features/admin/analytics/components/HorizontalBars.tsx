"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { barX, defineChart } from "@tanstack/charts";
import { scaleBand } from "@tanstack/charts/scales/band";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { tooltip } from "@tanstack/charts/tooltip";

import { cn } from "@/lib/utils";
import {
  CHART_BLUE,
  faTick,
  RumeraChart,
  rumeraChartTheme,
  rumeraSvgAnimation,
  usePrefersReducedMotion,
} from "@/lib/charts";

const ROW_PX = 36;
const AXIS_PX = 40;

export type RankingBar = {
  label: string;
  value: number;
  href?: string;
};

export function rankHorizontalBars(
  data: readonly RankingBar[],
): RankingBar[] {
  return [...data].sort((a, b) => b.value - a.value);
}

export function formatRankingTooltip(label: string, display: string): string {
  return `${label}: ${display}`;
}

export function defineHorizontalRankingChart(
  data: readonly RankingBar[],
  {
    color,
    valueFormatter,
    reduced,
  }: {
    color: string;
    valueFormatter: (value: number) => string;
    reduced: boolean;
  },
) {
  const ranked = rankHorizontalBars(data);

  return defineChart({
    marks: [
      barX(ranked, {
        id: "ranking",
        x: "value",
        y: "label",
        key: (row) => row.href ?? row.label,
        fill: color,
        fillOpacity: 0.85,
        radius: 4,
        inset: 2,
        maxThickness: 22,
      }),
    ],
    x: {
      scale: scaleLinear,
      nice: true,
      grid: true,
      axis: {
        ticks: {
          count: 4,
          format: (value) => valueFormatter(Number(value)),
        },
        tickLabels: { fontSize: 11 },
      },
    },
    y: {
      scale: () =>
        scaleBand<string>()
          .domain(ranked.map((row) => row.label))
          .paddingInner(0.16)
          .paddingOuter(0.08),
      grid: false,
      axis: {
        ticks: { size: 0 },
        tickLabels: { fontSize: 12 },
      },
    },
    tooltip: {
      use: tooltip,
      format: (point) =>
        formatRankingTooltip(
          point.datum.label,
          valueFormatter(point.datum.value),
        ),
    },
    svgAnimation: reduced ? false : rumeraSvgAnimation,
    theme: rumeraChartTheme,
  });
}

export function HorizontalBars({
  data,
  className,
  color = CHART_BLUE,
  valueFormatter = faTick,
  ariaLabel = "رتبه‌بندی",
}: {
  data: RankingBar[];
  className?: string;
  color?: string;
  valueFormatter?: (value: number) => string;
  ariaLabel?: string;
}) {
  const router = useRouter();
  const reduced = usePrefersReducedMotion();
  const definition = React.useMemo(
    () => defineHorizontalRankingChart(data, { color, valueFormatter, reduced }),
    [color, data, reduced, valueFormatter],
  );

  if (data.length === 0) {
    return null;
  }

  const clickable = data.some((row) => Boolean(row.href));
  const height = Math.max(160, data.length * ROW_PX + AXIS_PX);

  return (
    <RumeraChart
      definition={definition}
      ariaLabel={ariaLabel}
      ariaDescription={
        clickable ? "برای باز کردن مورد، نوار را انتخاب کنید." : undefined
      }
      className={cn("min-w-0 w-full", className)}
      height={height}
      initialWidth={480}
      style={clickable ? { cursor: "pointer" } : undefined}
      onSelect={(point) => {
        const href = point?.datum.href;
        if (href) router.push(href);
      }}
    />
  );
}
