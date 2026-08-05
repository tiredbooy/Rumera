import { describe, expect, it } from "vitest";

import {
  parseMonitoringRange,
  promQueries,
  PROM_JOB,
  rangeWindowSeconds,
} from "./queries";

describe("monitoring queries", () => {
  it("parses range query params with a safe default", () => {
    expect(parseMonitoringRange("24h")).toBe("24h");
    expect(parseMonitoringRange(["7d", "1h"])).toBe("7d");
    expect(parseMonitoringRange("nope")).toBe("1h");
    expect(parseMonitoringRange(undefined)).toBe("1h");
  });

  it("scopes PromQL to the authored scrape job", () => {
    const q = promQueries("1h");
    expect(q.up).toContain(`job="${PROM_JOB}"`);
    expect(q.requestRate).toContain("http_requests_total");
    expect(q.p95).toContain("histogram_quantile(0.95");
    expect(q.errorRatio).toContain('status=~"5.."');
    expect(rangeWindowSeconds("7d")).toBe(7 * 24 * 3600);
  });
});
