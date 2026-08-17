import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ExternalLink,
  Gauge,
  Server,
  Timer,
} from "lucide-react";

import {
  circuitLabel,
  formatLatencyMs,
  formatPercent,
  formatRate,
  loadMonitoringSnapshot,
} from "@/features/admin/monitoring/api/prometheus";
import { MonitoringCharts } from "@/features/admin/monitoring/components/dynamic-charts";
import { MonitoringRangeToggle } from "@/features/admin/monitoring/components/MonitoringRangeToggle";
import { faNum } from "@/lib/products";
import { cn } from "@/lib/utils";

function MetricCard({
  label,
  value,
  hint,
  tone = "default",
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "good" | "warn" | "bad";
  icon: typeof Activity;
}) {
  return (
    <div
      className={cn(
        "border-hairline rounded-2xl bg-card p-4 ring-1 ring-foreground/5 sm:p-5",
        tone === "good" && "ring-success/25",
        tone === "warn" && "ring-warning/25",
        tone === "bad" && "ring-destructive/25",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium text-muted-foreground sm:text-sm">
          {label}
        </p>
        <Icon className="size-4 shrink-0 text-primary" aria-hidden />
      </div>
      <p className="mt-2 font-serif text-2xl tabular-nums sm:text-3xl">
        {value}
      </p>
      {hint ? (
        <p className="mt-1 text-[11px] text-muted-foreground sm:text-xs">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export async function MonitoringBoard({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const sp = await searchParams;
  const result = await loadMonitoringSnapshot(sp.range);
  const range = result.ok ? result.data.range : "1h";
  const grafanaUrl =
    process.env.NEXT_PUBLIC_GRAFANA_URL?.replace(/\/$/, "") ||
    "http://localhost:3001";

  return (
    <div className="space-y-6 sm:space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="eyebrow mb-1">عملیات</p>
          <h1 className="font-serif text-3xl sm:text-4xl">مانیتورینگ API</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            نرخ درخواست، تأخیر، خطا، کش و سلامت سرویس از Prometheus — همان
            متریک‌هایی که از <code className="text-xs">/metrics</code> بک‌اند
            scrape می‌شوند.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <MonitoringRangeToggle active={range} />
          <Link
            href={grafanaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-1.5 text-xs font-medium text-primary outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            Grafana کامل
            <ExternalLink className="size-3.5" aria-hidden />
          </Link>
        </div>
      </header>

      {!result.ok ? (
        <div
          role="status"
          className="border-hairline rounded-3xl bg-card/80 p-6 ring-1 ring-foreground/5 sm:p-8"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" />
            <div className="min-w-0">
              <h2 className="font-serif text-xl">
                {result.reason === "unconfigured"
                  ? "Prometheus پیکربندی نشده"
                  : "متریک‌ها در دسترس نیستند"}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {result.message}
              </p>
              <ol className="mt-4 list-decimal space-y-1 pe-5 text-sm text-muted-foreground">
                <li>
                  از مسیر{" "}
                  <code className="text-xs">
                    apps/backend/deploy/observability
                  </code>{" "}
                  استک را بالا بیاورید (مستندات زیر).
                </li>
                <li>
                  <code className="text-xs">PROMETHEUS_URL=http://localhost:9090</code>{" "}
                  را برای سرور Next تنظیم کنید.
                </li>
                <li>
                  scrape هدف{" "}
                  <code className="text-xs">backend:8080/metrics</code> را در
                  Prometheus تأیید کنید.
                </li>
              </ol>
            </div>
          </div>
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            آخرین به‌روزرسانی:{" "}
            <time dateTime={result.data.fetchedAt}>
              {new Date(result.data.fetchedAt).toLocaleString("fa-IR")}
            </time>
          </p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
            <MetricCard
              icon={Server}
              label="سلامت سرویس"
              value={
                result.data.serviceUp === 1
                  ? "بالا"
                  : result.data.serviceUp === 0
                    ? "پایین"
                    : "—"
              }
              tone={
                result.data.serviceUp === 1
                  ? "good"
                  : result.data.serviceUp === 0
                    ? "bad"
                    : "default"
              }
              hint={`up{job="rumera-backend"}`}
            />
            <MetricCard
              icon={Activity}
              label="نرخ درخواست"
              value={formatRate(result.data.requestRate)}
              hint="sum(rate(http_requests_total))"
            />
            <MetricCard
              icon={AlertTriangle}
              label="نسبت خطای ۵xx"
              value={formatPercent(result.data.errorRatio)}
              tone={
                result.data.errorRatio != null && result.data.errorRatio > 0.05
                  ? "bad"
                  : result.data.errorRatio != null &&
                      result.data.errorRatio > 0.01
                    ? "warn"
                    : "good"
              }
            />
            <MetricCard
              icon={Timer}
              label="تأخیر p50 / p95 / p99"
              value={`${formatLatencyMs(result.data.latency.p50)} · ${formatLatencyMs(result.data.latency.p95)} · ${formatLatencyMs(result.data.latency.p99)}`}
              hint="histogram_quantile روی http_request_duration_seconds"
            />
            <MetricCard
              icon={Gauge}
              label="نسبت hit کش"
              value={formatPercent(result.data.cacheHitRatio)}
              hint="cache_requests_total"
            />
            <MetricCard
              icon={Server}
              label="مدارشکن کش"
              value={circuitLabel(result.data.cacheCircuitState)}
              tone={
                result.data.cacheCircuitState === 2
                  ? "bad"
                  : result.data.cacheCircuitState === 1
                    ? "warn"
                    : "default"
              }
            />
          </div>

          <MonitoringCharts data={result.data} />

          <p className="text-xs text-muted-foreground">
            نقاط سری:{" "}
            {faNum(result.data.series.requestRate.length)} نمونه در بازهٔ انتخابی.
          </p>
        </>
      )}
    </div>
  );
}
