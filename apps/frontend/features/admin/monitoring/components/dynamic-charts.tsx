"use client";

import dynamic from "next/dynamic";

import type { MonitoringSnapshot } from "@/features/admin/monitoring/lib/types";

function MonitoringChartsFallback() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="border-hairline h-56 rounded-2xl bg-card ring-1 ring-foreground/5" />
      <div className="border-hairline h-56 rounded-2xl bg-card ring-1 ring-foreground/5" />
      <div className="border-hairline h-56 rounded-2xl bg-card ring-1 ring-foreground/5" />
    </div>
  );
}

/** Client-only — keeps `@tanstack/charts` out of the RSC graph. */
export const MonitoringCharts = dynamic<{ data: MonitoringSnapshot }>(
  () => import("./MonitoringCharts").then((m) => m.MonitoringCharts),
  { ssr: false, loading: () => <MonitoringChartsFallback /> },
);
