/**
 * Public product search: GET /products?search=
 *
 * Default PROFILE=smoke (open arrival). Override with PROFILE=stress|breakpoint|spike|soak.
 *
 * Usage:
 *   k6 run load-tests/k6/search.js
 *   PROFILE=stress SEARCH_TERMS="wine,ویسکی,reserve" k6 run load-tests/k6/search.js
 *
 * Env:
 *   API_BASE, HEALTH_URL, ALLOW_REMOTE
 *   PROFILE, RATE_SCALE, PRE_ALLOCATED_VUS, MAX_VUS
 *   SEARCH_TERMS     comma-separated (Persian + Latin defaults)
 *   P95_MS, P99_MS, MAX_ERROR_RATE, THINK_MIN, THINK_MAX
 *   RESULTS_FILE
 */
import http from "k6/http";
import { check, fail, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

import {
  arrivalRateScenario,
  csv,
  currentLoadBand,
  envNumber,
  loadProfile,
  randomBetween,
  randomItem,
  requireLoadTestPermission,
  thresholdsFor,
  withoutTrailingSlash,
} from "./lib/config.js";
import { capacitySummary } from "./lib/summary.js";

const API_BASE = withoutTrailingSlash(
  __ENV.API_BASE || "http://localhost:8080/api/v1",
);
const HEALTH_URL =
  __ENV.HEALTH_URL || `${API_BASE.replace(/\/api\/v1$/, "")}/health`;
const PROFILE = loadProfile("smoke");
const P95_MS = envNumber("P95_MS", 1000, 1);
const P99_MS = envNumber("P99_MS", 2000, 1);
const MAX_ERROR_RATE = envNumber("MAX_ERROR_RATE", 0.01, 0);
const THINK_MIN = envNumber("THINK_MIN", 0.1, 0);
const THINK_MAX = envNumber("THINK_MAX", 0.5, THINK_MIN);
const SEARCH_TERMS = csv(
  "SEARCH_TERMS",
  "wine,red,reserve,rum,ویسکی,شراب,رزرو,رام",
);
const RESULT_FILE =
  __ENV.RESULTS_FILE || "load-tests/results/search-summary.json";

const journeyFailures = new Rate("journey_failures");
const journeyDuration = new Trend("journey_duration", true);

export const options = {
  scenarios: { product_search: arrivalRateScenario("searchJourney", PROFILE) },
  thresholds: {
    ...thresholdsFor(PROFILE, P95_MS, P99_MS, MAX_ERROR_RATE),
    "http_req_duration{endpoint:search}": [`p(95)<${P95_MS}`],
  },
  summaryTrendStats: ["avg", "min", "med", "p(90)", "p(95)", "p(99)", "max"],
  discardResponseBodies: true,
};

function params(name, endpoint, loadBand) {
  return {
    headers: {
      Accept: "application/json",
      "User-Agent": "rumera-k6-search/1.0",
      "X-Load-Test": "rumera-search",
    },
    tags: { name, endpoint, load_band: loadBand },
    timeout: __ENV.REQUEST_TIMEOUT || "10s",
  };
}

export function setup() {
  requireLoadTestPermission(API_BASE);

  const health = http.get(HEALTH_URL, params("GET /health", "health", "setup"));
  if (health.status !== 200) {
    fail(`Health check failed: ${HEALTH_URL} returned ${health.status}`);
  }
  if (SEARCH_TERMS.length === 0) {
    fail("SEARCH_TERMS resolved empty; pass at least one term.");
  }
  return { terms: SEARCH_TERMS };
}

export function searchJourney(data) {
  const startedAt = Date.now();
  const loadBand = currentLoadBand(PROFILE);
  const term = randomItem(data.terms);
  const response = http.get(
    `${API_BASE}/products?page=1&limit=24&search=${encodeURIComponent(term)}`,
    params("GET /products?search=", "search", loadBand),
  );
  const ok = check(response, {
    "search 200": (res) => res.status === 200,
    "search JSON": (res) =>
      (res.headers["Content-Type"] || "").includes("application/json"),
  });

  journeyFailures.add(!ok, { load_band: loadBand });
  journeyDuration.add(Date.now() - startedAt, { load_band: loadBand });
  sleep(randomBetween(THINK_MIN, THINK_MAX));
}

export function handleSummary(data) {
  return capacitySummary(data, {
    title: "Rumera product search",
    profile: PROFILE,
    resultFile: RESULT_FILE,
  });
}
