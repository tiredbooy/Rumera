export type MonitoringRange = "1h" | "6h" | "24h" | "7d";

export type MonitoringPoint = {
  t: number; // unix seconds
  v: number;
};

export type MonitoringSnapshot = {
  /** ISO time of the successful Prometheus fetch. */
  fetchedAt: string;
  range: MonitoringRange;
  /** Backend scrape target is up (1) or down (0). null if query failed. */
  serviceUp: number | null;
  /** Request rate (req/s). */
  requestRate: number | null;
  /** 5xx share of requests 0–1. */
  errorRatio: number | null;
  /** Latency quantiles in seconds. */
  latency: {
    p50: number | null;
    p95: number | null;
    p99: number | null;
  };
  /** Cache hit ratio 0–1. */
  cacheHitRatio: number | null;
  /** Circuit breaker state gauge. */
  cacheCircuitState: number | null;
  /** Series for charts. */
  series: {
    requestRate: MonitoringPoint[];
    errorRatio: MonitoringPoint[];
    p95: MonitoringPoint[];
  };
};

export type MonitoringLoadResult =
  | { ok: true; data: MonitoringSnapshot }
  | {
      ok: false;
      reason: "unconfigured" | "unreachable" | "error";
      message: string;
    };
