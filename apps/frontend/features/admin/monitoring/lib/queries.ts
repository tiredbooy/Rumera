import type { MonitoringRange } from "./types";

/** Job label from deploy/observability/prometheus.yml */
export const PROM_JOB = "rumera-backend";

export function rangeWindowSeconds(range: MonitoringRange): number {
  switch (range) {
    case "1h":
      return 3600;
    case "6h":
      return 6 * 3600;
    case "24h":
      return 24 * 3600;
    case "7d":
      return 7 * 24 * 3600;
  }
}

export function rangeStepSeconds(range: MonitoringRange): number {
  switch (range) {
    case "1h":
      return 30;
    case "6h":
      return 60;
    case "24h":
      return 5 * 60;
    case "7d":
      return 30 * 60;
  }
}

/** Instant rate window aligned with dashboard range. */
export function rateWindow(range: MonitoringRange): string {
  switch (range) {
    case "1h":
      return "5m";
    case "6h":
      return "10m";
    case "24h":
      return "15m";
    case "7d":
      return "1h";
  }
}

export function promQueries(range: MonitoringRange) {
  const w = rateWindow(range);
  const job = `job="${PROM_JOB}"`;
  return {
    up: `max(up{${job}})`,
    requestRate: `sum(rate(http_requests_total{${job}}[${w}]))`,
    errorRatio: `sum(rate(http_requests_total{${job},status=~"5.."}[${w}])) / clamp_min(sum(rate(http_requests_total{${job}}[${w}])), 1e-9)`,
    p50: `histogram_quantile(0.50, sum(rate(http_request_duration_seconds_bucket{${job}}[${w}])) by (le))`,
    p95: `histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{${job}}[${w}])) by (le))`,
    p99: `histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket{${job}}[${w}])) by (le))`,
    cacheHitRatio: `sum(rate(cache_requests_total{result="hit"}[${w}])) / clamp_min(sum(rate(cache_requests_total[${w}])), 1e-9)`,
    cacheCircuit: `max(cache_circuit_state)`,
  } as const;
}

export function parseMonitoringRange(
  value: string | string[] | undefined,
): MonitoringRange {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === "1h" || raw === "6h" || raw === "24h" || raw === "7d") return raw;
  return "1h";
}
