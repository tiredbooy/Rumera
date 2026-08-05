"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { MonitoringSnapshot } from "@/features/admin/monitoring/lib/types";

function toChart(
  points: { t: number; v: number }[],
  map: (v: number) => number = (v) => v,
) {
  return points.map((p) => ({
    t: p.t * 1000,
    v: map(p.v),
    label: new Date(p.t * 1000).toLocaleTimeString("fa-IR", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  }));
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
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={rate}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} minTickGap={24} />
            <YAxis tick={{ fontSize: 10 }} width={40} />
            <Tooltip />
            <Area
              type="monotone"
              dataKey="v"
              name="req/s"
              stroke="hsl(var(--primary))"
              fill="hsl(var(--primary) / 0.15)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="خطای ۵xx (٪)" empty={errors.length === 0}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={errors}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} minTickGap={24} />
            <YAxis tick={{ fontSize: 10 }} width={40} />
            <Tooltip />
            <Area
              type="monotone"
              dataKey="v"
              name="٪"
              stroke="hsl(var(--destructive))"
              fill="hsl(var(--destructive) / 0.12)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="تأخیر p95 (ms)" empty={p95.length === 0}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={p95}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} minTickGap={24} />
            <YAxis tick={{ fontSize: 10 }} width={48} />
            <Tooltip />
            <Area
              type="monotone"
              dataKey="v"
              name="ms"
              stroke="hsl(var(--chart-2))"
              fill="hsl(var(--chart-2) / 0.15)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
