import "server-only";

import {
  parseMonitoringRange,
  promQueries,
  rangeStepSeconds,
  rangeWindowSeconds,
} from "@/features/admin/monitoring/lib/queries";
import type {
  MonitoringLoadResult,
  MonitoringPoint,
  MonitoringRange,
  MonitoringSnapshot,
} from "@/features/admin/monitoring/lib/types";

type PromVectorResult = {
  status: string;
  data?: {
    resultType: string;
    result: Array<{ value: [number, string] }>;
  };
  error?: string;
};

type PromMatrixResult = {
  status: string;
  data?: {
    resultType: string;
    result: Array<{ values: Array<[number, string]> }>;
  };
  error?: string;
};

function prometheusBaseUrl(
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const raw =
    env.PROMETHEUS_URL?.trim() ||
    env.NEXT_PUBLIC_PROMETHEUS_URL?.trim() ||
    "";
  if (!raw) return null;
  return raw.replace(/\/$/, "");
}

async function promGet<T>(
  base: string,
  path: string,
  params: Record<string, string>,
  signal?: AbortSignal,
): Promise<T> {
  const url = new URL(`${base}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), {
    cache: "no-store",
    signal,
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Prometheus HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

function scalarFromVector(body: PromVectorResult): number | null {
  if (body.status !== "success") return null;
  const raw = body.data?.result?.[0]?.value?.[1];
  if (raw == null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function seriesFromMatrix(body: PromMatrixResult): MonitoringPoint[] {
  if (body.status !== "success") return [];
  const values = body.data?.result?.[0]?.values ?? [];
  return values
    .map(([t, v]) => {
      const n = Number(v);
      return Number.isFinite(n) ? { t, v: n } : null;
    })
    .filter((p): p is MonitoringPoint => p != null);
}

/**
 * Load a dashboard snapshot from Prometheus. Never throws — returns structured
 * offline/error states for the admin UI.
 */
export async function loadMonitoringSnapshot(
  rangeInput?: string | string[],
  env: NodeJS.ProcessEnv = process.env,
): Promise<MonitoringLoadResult> {
  const range = parseMonitoringRange(rangeInput);
  const base = prometheusBaseUrl(env);
  if (!base) {
    return {
      ok: false,
      reason: "unconfigured",
      message:
        "آدرس Prometheus تنظیم نشده است. متغیر PROMETHEUS_URL را روی سرور فرانت (مثلاً http://localhost:9090) قرار دهید.",
    };
  }

  const q = promQueries(range);
  const end = Math.floor(Date.now() / 1000);
  const start = end - rangeWindowSeconds(range);
  const step = String(rangeStepSeconds(range));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const [
      up,
      requestRate,
      errorRatio,
      p50,
      p95,
      p99,
      cacheHitRatio,
      cacheCircuit,
      rateSeries,
      errSeries,
      p95Series,
    ] = await Promise.all([
      promGet<PromVectorResult>(base, "/api/v1/query", { query: q.up }, controller.signal),
      promGet<PromVectorResult>(
        base,
        "/api/v1/query",
        { query: q.requestRate },
        controller.signal,
      ),
      promGet<PromVectorResult>(
        base,
        "/api/v1/query",
        { query: q.errorRatio },
        controller.signal,
      ),
      promGet<PromVectorResult>(base, "/api/v1/query", { query: q.p50 }, controller.signal),
      promGet<PromVectorResult>(base, "/api/v1/query", { query: q.p95 }, controller.signal),
      promGet<PromVectorResult>(base, "/api/v1/query", { query: q.p99 }, controller.signal),
      promGet<PromVectorResult>(
        base,
        "/api/v1/query",
        { query: q.cacheHitRatio },
        controller.signal,
      ),
      promGet<PromVectorResult>(
        base,
        "/api/v1/query",
        { query: q.cacheCircuit },
        controller.signal,
      ),
      promGet<PromMatrixResult>(
        base,
        "/api/v1/query_range",
        {
          query: q.requestRate,
          start: String(start),
          end: String(end),
          step,
        },
        controller.signal,
      ),
      promGet<PromMatrixResult>(
        base,
        "/api/v1/query_range",
        {
          query: q.errorRatio,
          start: String(start),
          end: String(end),
          step,
        },
        controller.signal,
      ),
      promGet<PromMatrixResult>(
        base,
        "/api/v1/query_range",
        {
          query: q.p95,
          start: String(start),
          end: String(end),
          step,
        },
        controller.signal,
      ),
    ]);

    const data: MonitoringSnapshot = {
      fetchedAt: new Date().toISOString(),
      range,
      serviceUp: scalarFromVector(up),
      requestRate: scalarFromVector(requestRate),
      errorRatio: scalarFromVector(errorRatio),
      latency: {
        p50: scalarFromVector(p50),
        p95: scalarFromVector(p95),
        p99: scalarFromVector(p99),
      },
      cacheHitRatio: scalarFromVector(cacheHitRatio),
      cacheCircuitState: scalarFromVector(cacheCircuit),
      series: {
        requestRate: seriesFromMatrix(rateSeries),
        errorRatio: seriesFromMatrix(errSeries),
        p95: seriesFromMatrix(p95Series),
      },
    };

    return { ok: true, data };
  } catch (error) {
    const aborted =
      error instanceof Error &&
      (error.name === "AbortError" || error.message.includes("abort"));
    return {
      ok: false,
      reason: aborted ? "unreachable" : "error",
      message: aborted
        ? "Prometheus در زمان مجاز پاسخ نداد. سرویس observability را بررسی کنید."
        : error instanceof Error
          ? error.message
          : "خطای ناشناخته در خواندن متریک‌ها",
    };
  } finally {
    clearTimeout(timer);
  }
}

export function formatLatencyMs(seconds: number | null): string {
  if (seconds == null || !Number.isFinite(seconds)) return "—";
  return `${Math.round(seconds * 1000)} ms`;
}

export function formatRate(rps: number | null): string {
  if (rps == null || !Number.isFinite(rps)) return "—";
  if (rps < 0.01) return `${rps.toFixed(3)} req/s`;
  return `${rps.toFixed(2)} req/s`;
}

export function formatPercent(ratio: number | null): string {
  if (ratio == null || !Number.isFinite(ratio)) return "—";
  return `${(ratio * 100).toFixed(1)}٪`;
}

export function circuitLabel(state: number | null): string {
  if (state == null) return "—";
  if (state === 0) return "بسته (سالم)";
  if (state === 1) return "نیمه‌باز";
  if (state === 2) return "باز (قطع)";
  return String(state);
}

export type { MonitoringRange };
