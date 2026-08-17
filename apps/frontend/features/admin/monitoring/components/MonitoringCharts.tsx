"use client";

import { useMemo } from "react";
import { areaY, defineChart, lineY } from "@tanstack/charts";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { tooltip } from "@tanstack/charts/tooltip";

import type { MonitoringSnapshot } from "@/features/admin/monitoring/lib/types";
import {
  faTick,
  RumeraChart,
  rumeraChartTheme,
  rumeraSvgAnimation,
  usePrefersReducedMotion,
} from "@/lib/charts";

type ChartRow = {
  t: number;
  v: number;
  label: string;
};

function formatFaTime(ms: number) {
  return new Date(ms).toLocaleTimeString("fa-IR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toChart(
  points: { t: number; v: number }[],
  map: (v: number) => number = (v) => v,
): ChartRow[] {
  return points.map((p) => ({
    t: p.t * 1000,
    v: map(p.v),
    label: formatFaTime(p.t * 1000),
  }));
}

function formatRate(v: number) {
  return faTick(v);
}

function formatPct(v: number) {
  return `${faTick(v)}٪`;
}

function formatMs(v: number) {
  return `${faTick(v)} ms`;
}

function seriesDefinition(
  rows: ChartRow[],
  opts: {
    color: string;
    valueLabel: string;
    formatValue: (v: number) => string;
    animate: boolean;
  },
) {
  const yMax = Math.max(0, ...rows.map((row) => row.v));
  return defineChart({
    marks: [
      areaY(rows, {
        id: "fill",
        x: "t",
        y1: 0,
        y2: "v",
        fill: opts.color,
        fillOpacity: 0.15,
      }),
      lineY(rows, {
        id: "line",
        x: "t",
        y: "v",
        stroke: opts.color,
        strokeWidth: 2,
      }),
    ],
    x: {
      scale: scaleLinear,
      grid: true,
      axis: {
        ticks: {
          format: (value) => formatFaTime(Number(value)),
        },
        tickLabels: {
          fontSize: 10,
          thin: { minGap: 24 },
        },
      },
    },
    y: {
      scale: () => scaleLinear().domain([0, yMax === 0 ? 1 : yMax]),
      nice: true,
      grid: true,
      axis: {
        ticks: {
          format: (value) => faTick(Number(value)),
        },
        tickLabels: { fontSize: 10 },
      },
    },
    clip: true,
    focus: "nearest-x",
    svgAnimation: opts.animate ? rumeraSvgAnimation : false,
    theme: rumeraChartTheme,
    tooltip: {
      use: tooltip,
      format: (point) =>
        `${point.datum.label} — ${opts.valueLabel}: ${opts.formatValue(point.datum.v)}`,
    },
  });
}

function SeriesChart({
  rows,
  color,
  valueLabel,
  formatValue,
  ariaLabel,
}: {
  rows: ChartRow[];
  color: string;
  valueLabel: string;
  formatValue: (v: number) => string;
  ariaLabel: string;
}) {
  const reduceMotion = usePrefersReducedMotion();
  const definition = useMemo(
    () =>
      seriesDefinition(rows, {
        color,
        valueLabel,
        formatValue,
        animate: !reduceMotion,
      }),
    [rows, color, valueLabel, formatValue, reduceMotion],
  );

  return (
    <RumeraChart
      definition={definition}
      height={192}
      initialWidth={360}
      ariaLabel={ariaLabel}
      className="h-full min-h-0 w-full"
    />
  );
}

function ChartCard({
  title,
  children,
  empty,
}: {
  title: string;
  children: React.ReactNode;
  empty: boolean;
}) {
  return (
    <div className="border-hairline rounded-2xl bg-card p-4 ring-1 ring-foreground/5 sm:p-5">
      <h3 className="mb-4 text-sm font-medium text-muted-foreground">{title}</h3>
      {empty ? (
        <p className="flex h-48 items-center justify-center text-sm text-muted-foreground">
          داده‌ای برای این بازه نیست
        </p>
      ) : (
        <div className="h-48 w-full min-w-0 sm:h-56">{children}</div>
      )}
    </div>
  );
}

export function MonitoringCharts({ data }: { data: MonitoringSnapshot }) {
  const rate = toChart(data.series.requestRate);
  const errors = toChart(data.series.errorRatio, (v) => v * 100);
  const p95 = toChart(data.series.p95, (v) => v * 1000);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <ChartCard title="نرخ درخواست (req/s)" empty={rate.length === 0}>
        <SeriesChart
          rows={rate}
          color="var(--primary)"
          valueLabel="req/s"
          formatValue={formatRate}
          ariaLabel="نرخ درخواست در ثانیه"
        />
      </ChartCard>

      <ChartCard title="خطای ۵xx (٪)" empty={errors.length === 0}>
        <SeriesChart
          rows={errors}
          color="var(--destructive)"
          valueLabel="٪"
          formatValue={formatPct}
          ariaLabel="سهم خطای پنج‌صد"
        />
      </ChartCard>

      <ChartCard title="تأخیر p95 (ms)" empty={p95.length === 0}>
        <SeriesChart
          rows={p95}
          color="var(--chart-2)"
          valueLabel="ms"
          formatValue={formatMs}
          ariaLabel="تأخیر صدک نود و پنج به میلی‌ثانیه"
        />
      </ChartCard>
    </div>
  );
}
