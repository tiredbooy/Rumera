import exec from "k6/execution";
import { fail } from "k6";

export function envNumber(name, fallback, min = 0) {
  const raw = __ENV[name];
  const value = raw === undefined || raw === "" ? fallback : Number(raw);
  if (!Number.isFinite(value) || value < min) {
    throw new Error(`${name} must be a number >= ${min}; received ${raw}`);
  }
  return value;
}

export function envBool(name, fallback = false) {
  const raw = __ENV[name];
  if (raw === undefined || raw === "") return fallback;
  return ["1", "true", "yes", "on"].includes(raw.toLowerCase());
}

export function csv(name, fallback) {
  const raw = __ENV[name] || fallback;
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function withoutTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}

export function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

export function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

export function requireLoadTestPermission(url) {
  const target = url.toLowerCase();
  const isLocal =
    target.includes("localhost") ||
    target.includes("127.0.0.1") ||
    target.includes("[::1]") ||
    target.includes("host.docker.internal");

  if (!isLocal && !envBool("ALLOW_REMOTE")) {
    fail(
      `Refusing to load test remote target ${url}. Set ALLOW_REMOTE=true only when you own the target and have permission.`,
    );
  }
}

const PROFILE_DEFINITIONS = {
  smoke: [
    ["ramp_1", "5s", 1],
    ["hold_1", "10s", 1],
    ["recovery", "5s", 0],
  ],
  stress: [
    ["ramp_5", "20s", 5],
    ["hold_5", "40s", 5],
    ["ramp_10", "20s", 10],
    ["hold_10", "40s", 10],
    ["ramp_25", "20s", 25],
    ["hold_25", "45s", 25],
    ["ramp_50", "20s", 50],
    ["hold_50", "45s", 50],
    ["recovery", "20s", 0],
  ],
  breakpoint: [
    ["ramp_10", "15s", 10],
    ["hold_10", "30s", 10],
    ["ramp_25", "15s", 25],
    ["hold_25", "30s", 25],
    ["ramp_50", "15s", 50],
    ["hold_50", "30s", 50],
    ["ramp_100", "15s", 100],
    ["hold_100", "30s", 100],
    ["ramp_200", "15s", 200],
    ["hold_200", "30s", 200],
    ["recovery", "30s", 0],
  ],
  spike: [
    ["ramp_5", "15s", 5],
    ["hold_5", "30s", 5],
    ["spike_ramp", "3s", 100],
    ["hold_100", "30s", 100],
    ["recover_5", "10s", 5],
    ["hold_recovery", "30s", 5],
    ["recovery", "15s", 0],
  ],
  soak: [
    ["ramp_20", "30s", 20],
    ["hold_20", __ENV.SOAK_DURATION || "15m", 20],
    ["recovery", "30s", 0],
  ],
};

function durationMs(value) {
  const units = { ms: 1, s: 1000, m: 60000, h: 3600000 };
  const match = /^(\d+(?:\.\d+)?)(ms|s|m|h)$/.exec(value);
  if (!match) throw new Error(`Unsupported k6 duration: ${value}`);
  return Number(match[1]) * units[match[2]];
}

export function loadProfile() {
  const name = __ENV.PROFILE || "stress";
  const definition = PROFILE_DEFINITIONS[name];
  if (!definition) {
    throw new Error(
      `Unknown PROFILE=${name}; choose smoke, stress, breakpoint, spike, or soak`,
    );
  }

  const scale = envNumber("RATE_SCALE", 1, 0.01);
  let elapsed = 0;
  const bands = definition.map(([label, duration, rawTarget]) => {
    const target =
      rawTarget === 0 ? 0 : Math.max(1, Math.round(rawTarget * scale));
    elapsed += durationMs(duration);
    return { label, duration, target, endMs: elapsed };
  });

  return {
    name,
    bands,
    stages: bands.map(({ duration, target }) => ({ duration, target })),
    holdBands: bands.filter((band) => band.label.startsWith("hold_")),
  };
}

export function currentLoadBand(profile) {
  const elapsed = exec.instance.currentTestRunDuration;
  for (const band of profile.bands) {
    if (elapsed <= band.endMs) return band.label;
  }
  return "finished";
}

export function arrivalRateScenario(execName, profile) {
  return {
    executor: "ramping-arrival-rate",
    exec: execName,
    startRate: 1,
    timeUnit: "1s",
    preAllocatedVUs: Math.floor(envNumber("PRE_ALLOCATED_VUS", 100, 1)),
    maxVUs: Math.floor(envNumber("MAX_VUS", 1000, 1)),
    stages: profile.stages,
    gracefulStop: __ENV.GRACEFUL_STOP || "30s",
    tags: { load_profile: profile.name },
  };
}

export function thresholdsFor(profile, p95Ms, p99Ms, maxErrorRate) {
  const thresholds = {
    checks: ["rate>0.99"],
    http_req_failed: [`rate<${maxErrorRate}`],
    http_req_duration: [`p(95)<${p95Ms}`, `p(99)<${p99Ms}`],
    dropped_iterations: ["count==0"],
    journey_failures: [`rate<${maxErrorRate}`],
  };

  for (const band of profile.holdBands) {
    thresholds[`http_reqs{load_band:${band.label}}`] = ["count>0"];
    thresholds[`http_req_failed{load_band:${band.label}}`] = [
      `rate<${maxErrorRate}`,
    ];
    thresholds[`http_req_duration{load_band:${band.label}}`] = [
      `p(95)<${p95Ms}`,
      `p(99)<${p99Ms}`,
    ];
  }
  return thresholds;
}
