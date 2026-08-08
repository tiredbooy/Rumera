/**
 * Read-only API capacity test.
 *
 * Finds the first sustained arrival-rate plateau where the API misses its SLO.
 * One iteration is a realistic browse journey containing several HTTP requests,
 * so a target of 50/s means 50 new journeys per second, not 50 raw requests/s.
 */
import http from "k6/http";
import { check, fail, group, sleep } from "k6";
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
const PROFILE = loadProfile();
const P95_MS = envNumber("P95_MS", 1000, 1);
const P99_MS = envNumber("P99_MS", 2000, 1);
const MAX_ERROR_RATE = envNumber("MAX_ERROR_RATE", 0.01, 0);
const THINK_MIN = envNumber("THINK_MIN", 0.2, 0);
const THINK_MAX = envNumber("THINK_MAX", 1.0, THINK_MIN);
const PRODUCT_LIMIT = Math.floor(envNumber("PRODUCT_LIMIT", 100, 1));
const SEARCH_TERMS = csv("SEARCH_TERMS", "wine,red,reserve,rum");
const RESULT_FILE =
  __ENV.RESULTS_FILE || "load-tests/results/api-capacity-summary.json";

const journeyFailures = new Rate("journey_failures");
const journeyDuration = new Trend("journey_duration", true);

export const options = {
  scenarios: { api_capacity: arrivalRateScenario("apiJourney", PROFILE) },
  thresholds: {
    ...thresholdsFor(PROFILE, P95_MS, P99_MS, MAX_ERROR_RATE),
    "http_req_duration{endpoint:catalogue}": [`p(95)<${P95_MS}`],
    "http_req_duration{endpoint:product_detail}": [`p(95)<${P95_MS}`],
    "http_req_duration{endpoint:discovery}": [`p(95)<${P95_MS}`],
  },
  summaryTrendStats: ["avg", "min", "med", "p(90)", "p(95)", "p(99)", "max"],
  // Retaining every catalogue/detail body can make the load generator itself
  // the bottleneck. setup() opts its single seed request back into text mode.
  discardResponseBodies: true,
};

function params(name, endpoint, loadBand) {
  return {
    headers: {
      Accept: "application/json",
      "User-Agent": "rumera-k6-capacity/1.0",
      "X-Load-Test": "rumera-capacity",
    },
    tags: { name, endpoint, load_band: loadBand },
    timeout: __ENV.REQUEST_TIMEOUT || "10s",
  };
}

function responseOK(response, label) {
  return check(response, {
    [`${label}: status 200`]: (res) => res.status === 200,
    [`${label}: JSON response`]: (res) =>
      (res.headers["Content-Type"] || "").includes("application/json"),
  });
}

export function setup() {
  requireLoadTestPermission(API_BASE);

  const health = http.get(HEALTH_URL, params("GET /health", "health", "setup"));
  if (health.status !== 200) {
    fail(`Health check failed: ${HEALTH_URL} returned ${health.status}`);
  }

  const seedParams = params("GET /products (seed)", "setup", "setup");
  seedParams.responseType = "text";
  const seed = http.get(
    `${API_BASE}/products?page=1&limit=${PRODUCT_LIMIT}`,
    seedParams,
  );
  if (seed.status !== 200) {
    fail(`Product seed request failed with status ${seed.status}`);
  }

  let body;
  try {
    body = seed.json();
  } catch (_) {
    fail("Product seed response was not valid JSON");
  }

  const products = (body.results || [])
    .filter((product) => product && product.id)
    .map((product) => ({ id: product.id, slug: product.slug || "" }));
  if (products.length === 0) {
    fail(
      "No active products found. Seed the database before running capacity tests.",
    );
  }

  return { products };
}

export function apiJourney(data) {
  const startedAt = Date.now();
  const loadBand = currentLoadBand(PROFILE);
  let successful = true;
  const product = randomItem(data.products);
  const page = 1 + Math.floor(Math.random() * 3);
  const search = encodeURIComponent(randomItem(SEARCH_TERMS));

  group("catalogue", () => {
    const useSearch = Math.random() < 0.35;
    const query = useSearch
      ? `page=1&limit=24&search=${search}`
      : `page=${page}&limit=24&sortBy=created_at&orderBy=desc`;
    const response = http.get(
      `${API_BASE}/products?${query}`,
      params("GET /api/v1/products", "catalogue", loadBand),
    );
    successful = responseOK(response, "catalogue") && successful;
  });

  group("product detail", () => {
    const responses = http.batch([
      {
        method: "GET",
        url: `${API_BASE}/products/${product.id}`,
        params: params("GET /api/v1/products/:id", "product_detail", loadBand),
      },
      {
        method: "GET",
        url: `${API_BASE}/products/${product.id}/reviews/summary`,
        params: params(
          "GET /api/v1/products/:id/reviews/summary",
          "product_detail",
          loadBand,
        ),
      },
      {
        method: "GET",
        url: `${API_BASE}/recommendations/products/${product.id}/similar?limit=8`,
        params: params(
          "GET /api/v1/recommendations/products/:id/similar",
          "product_detail",
          loadBand,
        ),
      },
    ]);
    for (const response of responses) {
      successful =
        responseOK(response, "product detail dependency") && successful;
    }
  });

  group("discovery", () => {
    const path = randomItem([
      "/categories/tree",
      "/categories/featured",
      "/brands?limit=50",
      "/recipes?limit=12",
      "/blogs?limit=12",
      "/recommendations/trending?limit=12",
    ]);
    const response = http.get(
      `${API_BASE}${path}`,
      params(`GET ${path.split("?")[0]}`, "discovery", loadBand),
    );
    successful = responseOK(response, "discovery") && successful;
  });

  if (Math.random() < 0.15) {
    const responses = http.batch([
      {
        method: "GET",
        url: `${API_BASE}/hero-slides`,
        params: params("GET /api/v1/hero-slides", "home", loadBand),
      },
      {
        method: "GET",
        url: `${API_BASE}/settings`,
        params: params("GET /api/v1/settings", "home", loadBand),
      },
    ]);
    for (const response of responses) {
      successful = responseOK(response, "home dependency") && successful;
    }
  }

  journeyFailures.add(!successful, { load_band: loadBand });
  journeyDuration.add(Date.now() - startedAt, { load_band: loadBand });
  sleep(randomBetween(THINK_MIN, THINK_MAX));
}

export function handleSummary(data) {
  return capacitySummary(data, {
    title: "Rumera API capacity test",
    profile: PROFILE,
    resultFile: RESULT_FILE,
  });
}
