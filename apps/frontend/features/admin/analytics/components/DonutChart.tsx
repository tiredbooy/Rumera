"use client";

import * as React from "react";
import { defineChart } from "@tanstack/charts";
import { pie, polar, radialArc, radialText } from "@tanstack/charts/polar";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { tooltip } from "@tanstack/charts/tooltip";

import { cn } from "@/lib/utils";
import {
  faNum,
  RumeraChart,
  rumeraChartTheme,
  rumeraSvgAnimation,
  SLICE_COLORS,
  usePrefersReducedMotion,
} from "@/lib/charts";

export type DonutSlice = { label: string; value: number };

const TAU = Math.PI * 2;
/** Matches the previous Recharts `paddingAngle={2}` gap. */
const SLICE_GAP = (2 * Math.PI) / 180;

function sliceColor(index: number) {
  return SLICE_COLORS[index % SLICE_COLORS.length];
}

function isStatusSlice(datum: unknown): datum is DonutSlice {
  if (!datum || typeof datum !== "object") return false;
  const row = datum as Record<string, unknown>;
  return typeof row.label === "string" && typeof row.value === "number";
}

export function DonutChart({
  data,
  className,
  centerLabel,
  centerValue,
}: {
  data: DonutSlice[];
  className?: string;
  centerLabel?: string;
  centerValue?: string;
}) {
  const reduced = usePrefersReducedMotion();
  const definition = React.useMemo(() => {
    const slices = pie(data, { value: "value", gapAngle: SLICE_GAP });
    const labels = data.map((d) => d.label);
    const range = data.map((_, i) => sliceColor(i));
    const valueRows = centerValue
      ? [{ id: "center-value", angle: 0, radius: 0, text: centerValue }]
      : [];
    const labelRows = centerLabel
      ? [{ id: "center-label", angle: 0, radius: 0, text: centerLabel }]
      : [];

    return defineChart(
      {
        marks: [
          polar({
            inset: 8,
            radiusRatio: 0.82,
            angle: { scale: scaleLinear().domain([0, TAU]) },
            radius: { scale: scaleLinear().domain([0, 1]) },
            marks: [
              radialArc(slices, {
                id: "status-slices",
                key: "label",
                innerRadius: ({ radius }) => radius * 0.69,
                cornerRadius: 4,
                color: "label",
                stroke: "var(--card)",
                strokeWidth: 2,
              }),
              radialText(valueRows, {
                id: "center-total",
                angle: "angle",
                radius: "radius",
                key: "id",
                text: "text",
                dy: centerLabel ? -6 : 0,
                fill: "var(--foreground)",
                fontSize: 24,
                fontWeight: 600,
              }),
              radialText(labelRows, {
                id: "center-caption",
                angle: "angle",
                radius: "radius",
                key: "id",
                text: "text",
                dy: centerValue ? 16 : 0,
                fill: "var(--muted-foreground)",
                fontSize: 12,
              }),
            ],
          }),
        ],
        color: { domain: labels, range },
        margin: 0,
        theme: rumeraChartTheme,
      },
      {
        keyboard: true,
        svgAnimation: reduced ? false : rumeraSvgAnimation,
        tooltip: {
          use: tooltip,
          format: ({ datum }) =>
            isStatusSlice(datum) ? `${datum.label} · ${faNum(datum.value)}` : "",
        },
      },
    );
  }, [centerLabel, centerValue, data, reduced]);

  return (
    <RumeraChart
      definition={definition}
      ariaLabel="سفارش‌ها بر اساس وضعیت"
      className={cn("mx-auto aspect-square h-56 w-56", className)}
      height={224}
      initialWidth={224}
    />
  );
}

/** Coloured legend rows for a donut, with Persian numerals. */
export function DonutLegend({
  data,
  unit = "",
}: {
  data: DonutSlice[];
  unit?: string;
}) {
  return (
    <ul className="flex flex-col gap-2">
      {data.map((d, i) => (
        <li key={d.label} className="flex items-center gap-2 text-sm">
          <span
            className="size-2.5 rounded-full"
            style={{ background: sliceColor(i) }}
          />
          <span className="text-muted-foreground">{d.label}</span>
          <span className="ms-auto font-medium tabular-nums">
            {faNum(d.value)}
            {unit}
          </span>
        </li>
      ))}
    </ul>
  );
}
