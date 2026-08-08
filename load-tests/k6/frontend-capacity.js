/**
 * End-to-end storefront capacity test.
 *
 * Exercises Next.js-rendered pages while using the public API only to discover
 * valid product slugs during setup. Run this after capacity.js to reveal the
 * extra limit introduced by the frontend/gateway layer.
 */
import http from "k6/http";
import { check, fail, group, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

import {
  arrivalRateScenario,
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

const BASE_URL = withoutTrailingSlash(
  __ENV.BASE_URL || "http://localhost:3000",
);
const API_BASE = withoutTrailingSlash(
  __ENV.API_BASE || "http://localhost:8080/api/v1",
);
const PROFILE = loadProfile();
const P95_MS = envNumber("P95_MS", 3000, 1);
const P99_MS = envNumber("P99_MS", 6000, 1);
const MAX_ERROR_RATE = envNumber("MAX_ERROR_RATE", 0.02, 0);
const THINK_MIN = envNumber("THINK_MIN", 0.5, 0);
const THINK_MAX = envNumber("THINK_MAX", 2.0, THINK_MIN);
const RESULT_FILE =
  __ENV.RESULTS_FILE || "load-tests/results/frontend-capacity-summary.json";

const journeyFailures = new Rate("journey_failures");
const journeyDuration = new Trend("journey_duration", true);

export const options = {
  scenarios: {
    storefront_capacity: arrivalRateScenario("storefrontJourney", PROFILE),
  },
  thresholds: thresholdsFor(PROFILE, P95_MS, P99_MS, MAX_ERROR_RATE),
  summaryTrendStats: ["avg", "min", "med", "p(90)", "p(95)", "p(99)", "max"],
  discardResponseBodies: true,
};

function pageParams(name, pageType, loadBand) {
  return {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": "rumera-k6-storefront/1.0",
      "X-Load-Test": "rumera-frontend-capacity",
    },
    tags: { name, endpoint: pageType, load_band: loadBand },
    redirects: 5,
    timeout: __ENV.REQUEST_TIMEOUT || "15s",
  };
}

function pageOK(response, label) {
  return check(response, {
    [`${label}: status 2xx/3xx`]: (res) =>
      res.status >= 200 && res.status < 400,
    [`${label}: HTML response`]: (res) =>
      (res.headers["Content-Type"] || "").includes("text/html"),
  });
}

export function setup() {
  requireLoadTestPermission(BASE_URL);
  requireLoadTestPermission(API_BASE);

  const seed = http.get(`${API_BASE}/products?page=1&limit=100`, {
    tags: {
      name: "GET /products (seed)",
      endpoint: "setup",
      load_band: "setup",
    },
    timeout: "10s",
    responseType: "text",
  });
  if (seed.status !== 200) fail(`Product seed request returned ${seed.status}`);

  let products = [];
  try {
    products = seed
      .json()
      .results.filter((product) => product && product.slug)
      .map((product) => ({ slug: product.slug }));
  } catch (_) {
    fail("Product seed response did not contain a valid results array");
  }
  if (products.length === 0)
    fail("No product slugs found; seed the database first");
  return { products };
}

export function storefrontJourney(data) {
  const startedAt = Date.now();
  const loadBand = currentLoadBand(PROFILE);
  let successful = true;

  group("landing", () => {
    const response = http.get(
      `${BASE_URL}/`,
      pageParams("GET /", "home_page", loadBand),
    );
    successful = pageOK(response, "home page") && successful;
  });
  sleep(randomBetween(THINK_MIN, THINK_MAX));

  group("browse", () => {
    const path = randomItem([
      "/products",
      "/products?sort=newest",
      "/search?q=reserve",
      "/brands",
      "/recipes",
      "/journal",
    ]);
    const response = http.get(
      `${BASE_URL}${path}`,
      pageParams(`GET ${path.split("?")[0]}`, "listing_page", loadBand),
    );
    successful = pageOK(response, "listing page") && successful;
  });
  sleep(randomBetween(THINK_MIN, THINK_MAX));

  group("product", () => {
    const product = randomItem(data.products);
    const response = http.get(
      `${BASE_URL}/products/${encodeURIComponent(product.slug)}`,
      pageParams("GET /products/:slug", "product_page", loadBand),
    );
    successful = pageOK(response, "product page") && successful;
  });

  journeyFailures.add(!successful, { load_band: loadBand });
  journeyDuration.add(Date.now() - startedAt, { load_band: loadBand });
  sleep(randomBetween(THINK_MIN, THINK_MAX));
}

export function handleSummary(data) {
  return capacitySummary(data, {
    title: "Rumera end-to-end storefront capacity test",
    profile: PROFILE,
    resultFile: RESULT_FILE,
  });
}
