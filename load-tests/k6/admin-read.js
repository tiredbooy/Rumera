/**
 * Read-only admin list endpoints.
 *
 * ADMIN_ACCESS_TOKEN is required to send traffic. Without it the script
 * skips (one no-op iteration) unless REQUIRE_ADMIN=1, which fails setup.
 *
 * Usage:
 *   ADMIN_ACCESS_TOKEN=eyJ... k6 run load-tests/k6/admin-read.js
 *   ADMIN_ACCESS_TOKEN=... PROFILE=stress k6 run load-tests/k6/admin-read.js
 *   REQUIRE_ADMIN=1 k6 run load-tests/k6/admin-read.js   # fail if no token
 *
 * Env:
 *   API_BASE, ALLOW_REMOTE
 *   ADMIN_ACCESS_TOKEN    staff JWT (never commit)
 *   REQUIRE_ADMIN         1 = fail when the token is missing
 *   PROFILE (default smoke), RATE_SCALE, PRE_ALLOCATED_VUS, MAX_VUS
 *   P95_MS, P99_MS, MAX_ERROR_RATE, THINK_MIN, THINK_MAX
 *   RESULTS_FILE
 */
import http from "k6/http";
import { check, fail, group, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

import {
  arrivalRateScenario,
  currentLoadBand,
  envBool,
  envNumber,
  loadProfile,
  randomBetween,
  requireLoadTestPermission,
  thresholdsFor,
  withoutTrailingSlash,
} from "./lib/config.js";
import { capacitySummary } from "./lib/summary.js";

const API_BASE = withoutTrailingSlash(
  __ENV.API_BASE || "http://localhost:8080/api/v1",
);
const TOKEN = __ENV.ADMIN_ACCESS_TOKEN || "";
const REQUIRE_ADMIN = envBool("REQUIRE_ADMIN", false);
const SKIP = !TOKEN;
const PROFILE = loadProfile("smoke");
const P95_MS = envNumber("P95_MS", 1000, 1);
const P99_MS = envNumber("P99_MS", 2000, 1);
const MAX_ERROR_RATE = envNumber("MAX_ERROR_RATE", 0.01, 0);
const THINK_MIN = envNumber("THINK_MIN", 0.2, 0);
const THINK_MAX = envNumber("THINK_MAX", 1.0, THINK_MIN);
const RESULT_FILE =
  __ENV.RESULTS_FILE || "load-tests/results/admin-read-summary.json";

const journeyFailures = new Rate("journey_failures");
const journeyDuration = new Trend("journey_duration", true);

export const options = SKIP
  ? {
      vus: 1,
      iterations: 1,
      thresholds: {},
    }
  : {
      scenarios: { admin_read: arrivalRateScenario("adminJourney", PROFILE) },
      thresholds: {
        ...thresholdsFor(PROFILE, P95_MS, P99_MS, MAX_ERROR_RATE),
        "http_req_duration{endpoint:admin_products}": [`p(95)<${P95_MS}`],
        "http_req_duration{endpoint:admin_orders}": [`p(95)<${P95_MS}`],
      },
      summaryTrendStats: ["avg", "min", "med", "p(90)", "p(95)", "p(99)", "max"],
      discardResponseBodies: true,
    };

function params(name, endpoint, loadBand) {
  return {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${TOKEN}`,
      "User-Agent": "rumera-k6-admin-read/1.0",
      "X-Load-Test": "rumera-admin-read",
    },
    tags: { name, endpoint, load_band: loadBand },
    timeout: __ENV.REQUEST_TIMEOUT || "10s",
  };
}

export function setup() {
  requireLoadTestPermission(API_BASE);

  if (!TOKEN) {
    if (REQUIRE_ADMIN) {
      fail(
        "ADMIN_ACCESS_TOKEN is required when REQUIRE_ADMIN=1. Export a staff JWT from a dedicated load-test admin (never commit secrets). Omit REQUIRE_ADMIN to skip.",
      );
    }
    console.warn(
      "admin-read: ADMIN_ACCESS_TOKEN not set — skipping admin GETs (read-only script).",
    );
    return { skip: true };
  }

  const probe = http.get(
    `${API_BASE}/admin/products?page=1&limit=1`,
    params("GET /admin/products (probe)", "setup", "setup"),
  );
  if (probe.status === 401 || probe.status === 403) {
    fail(
      `ADMIN_ACCESS_TOKEN was rejected (HTTP ${probe.status}). Use a staff JWT, never commit it.`,
    );
  }
  if (probe.status !== 200) {
    fail(`Admin products probe failed: HTTP ${probe.status}`);
  }
  return { skip: false };
}

export function adminJourney() {
  const startedAt = Date.now();
  const loadBand = currentLoadBand(PROFILE);
  let successful = true;

  group("admin products", () => {
    const response = http.get(
      `${API_BASE}/admin/products?page=1&limit=24`,
      params("GET /admin/products", "admin_products", loadBand),
    );
    successful =
      check(response, {
        "admin products 200": (res) => res.status === 200,
      }) && successful;
  });

  group("admin orders", () => {
    const response = http.get(
      `${API_BASE}/admin/orders?page=1&limit=24`,
      params("GET /admin/orders", "admin_orders", loadBand),
    );
    successful =
      check(response, {
        "admin orders 200": (res) => res.status === 200,
      }) && successful;
  });

  journeyFailures.add(!successful, { load_band: loadBand });
  journeyDuration.add(Date.now() - startedAt, { load_band: loadBand });
  sleep(randomBetween(THINK_MIN, THINK_MAX));
}

export default function adminReadSkipped(data) {
  if (data && data.skip) {
    return;
  }
  adminJourney();
}

export function handleSummary(data) {
  if (SKIP) {
    return {
      stdout:
        "\n=== Rumera admin read ===\nSkipped: ADMIN_ACCESS_TOKEN not set.\n",
    };
  }
  return capacitySummary(data, {
    title: "Rumera admin read",
    profile: PROFILE,
    resultFile: RESULT_FILE,
  });
}
