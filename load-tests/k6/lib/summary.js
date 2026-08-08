function metricValue(data, metric, key, fallback = 0) {
  const entry = data.metrics[metric];
  if (!entry || !entry.values || entry.values[key] === undefined)
    return fallback;
  return entry.values[key];
}

function number(value, digits = 1) {
  return Number(value || 0).toFixed(digits);
}

export function capacitySummary(data, config) {
  const lines = [
    "",
    `=== ${config.title} ===`,
    `Profile: ${config.profile.name}`,
    `Requests: ${Math.round(metricValue(data, "http_reqs", "count"))}`,
    `Throughput: ${number(metricValue(data, "http_reqs", "rate"))} req/s`,
    `HTTP failures: ${number(metricValue(data, "http_req_failed", "rate") * 100, 2)}%`,
    `Latency: p95=${number(metricValue(data, "http_req_duration", "p(95)"))}ms p99=${number(metricValue(data, "http_req_duration", "p(99)"))}ms`,
    `Dropped journeys: ${Math.round(metricValue(data, "dropped_iterations", "count"))}`,
    `Peak active VUs: ${Math.round(metricValue(data, "vus", "max"))}`,
    "",
    "Plateau results (the first failing row is your SLO breakpoint):",
    "band\trequests\tfailures\tp95 ms\tp99 ms",
  ];

  for (const band of config.profile.holdBands) {
    const suffix = `{load_band:${band.label}}`;
    lines.push(
      [
        `${band.label} (${band.target}/s)`,
        Math.round(metricValue(data, `http_reqs${suffix}`, "count")),
        `${number(metricValue(data, `http_req_failed${suffix}`, "rate") * 100, 2)}%`,
        number(metricValue(data, `http_req_duration${suffix}`, "p(95)")),
        number(metricValue(data, `http_req_duration${suffix}`, "p(99)")),
      ].join("\t"),
    );
  }

  lines.push("", `Full k6 summary: ${config.resultFile}`, "");
  return {
    stdout: lines.join("\n"),
    [config.resultFile]: JSON.stringify(data, null, 2),
  };
}
