/**
 * Authenticated (or anonymous) API browse.
 *
 * Login happens once in setup via public POST /auth/login when
 * LOADTEST_EMAIL + LOADTEST_PASSWORD are set. A pre-minted ACCESS_TOKEN
 * wins over login. Never commit secrets.
 *
 * All VUs share one token / one customer cart. That is a contention probe,
 * not a multi-shopper model.
 *
 * Usage:
 *   k6 run load-tests/k6/auth-browse.js
 *   ACCESS_TOKEN=eyJ... k6 run load-tests/k6/auth-browse.js
 *   LOADTEST_EMAIL=load@example.com LOADTEST_PASSWORD=... \
 *     k6 run load-tests/k6/auth-browse.js
 *
 * Env:
 *   API_BASE, HEALTH_URL, ALLOW_REMOTE
 *   ACCESS_TOKEN                          skip login
 *   LOADTEST_EMAIL, LOADTEST_PASSWORD     public login (setup only)
 *   REQUIRE_AUTH                          1 = fail setup when unauthenticated
 *   VUS, DURATION, SLEEP
 */
import http from "k6/http";
import { check, fail, group, sleep } from "k6";

import {
  envBool,
  envNumber,
  randomItem,
  requireLoadTestPermission,
  withoutTrailingSlash,
} from "./lib/config.js";

const API_BASE = withoutTrailingSlash(
  __ENV.API_BASE || "http://localhost:8080/api/v1",
);
const HEALTH_URL =
  __ENV.HEALTH_URL || `${API_BASE.replace(/\/api\/v1$/, "")}/health`;
const REQUIRE_AUTH = envBool("REQUIRE_AUTH", false);
const VUS = Math.floor(envNumber("VUS", 5, 1));
const DURATION = __ENV.DURATION || "30s";
const THINK = envNumber("SLEEP", 0.5, 0);

export const options = {
  vus: VUS,
  duration: DURATION,
  thresholds: {
    http_req_failed: ["rate<0.08"],
    http_req_duration: ["p(95)<3000"],
    checks: ["rate>0.95"],
  },
};

function params(name, extra = {}) {
  const { headers: extraHeaders, tags: extraTags, ...rest } = extra;
  return {
    headers: {
      Accept: "application/json",
      "User-Agent": "rumera-k6-auth-browse/1.0",
      "X-Load-Test": "rumera-auth-browse",
      ...(extraHeaders || {}),
    },
    tags: { name, ...(extraTags || {}) },
    timeout: __ENV.REQUEST_TIMEOUT || "10s",
    ...rest,
  };
}

function extractAccessToken(response) {
  try {
    const body = response.json();
    return (body && body.data && body.data.access_token) || "";
  } catch (_) {
    return "";
  }
}

function extractProducts(response) {
  try {
    const body = response.json();
    return (body.results || []).filter((product) => product && product.id);
  } catch (_) {
    return [];
  }
}

function resolveToken() {
  if (__ENV.ACCESS_TOKEN) return __ENV.ACCESS_TOKEN;

  const email = __ENV.LOADTEST_EMAIL || "";
  const password = __ENV.LOADTEST_PASSWORD || "";
  if (!email || !password) return "";

  const login = http.post(
    `${API_BASE}/auth/login`,
    JSON.stringify({ email, password }),
    params("POST /auth/login", {
      headers: { "Content-Type": "application/json" },
    }),
  );
  const token = extractAccessToken(login);
  if (!token) {
    fail(
      `Login failed (HTTP ${login.status}). Check LOADTEST_EMAIL / LOADTEST_PASSWORD. Never commit those values.`,
    );
  }
  return token;
}

export function setup() {
  requireLoadTestPermission(API_BASE);

  const health = http.get(HEALTH_URL, params("GET /health"));
  if (health.status !== 200) {
    fail(`Health check failed: ${HEALTH_URL} returned ${health.status}`);
  }

  const token = resolveToken();
  if (REQUIRE_AUTH && !token) {
    fail(
      "ACCESS_TOKEN or LOADTEST_EMAIL+LOADTEST_PASSWORD is required when REQUIRE_AUTH=1. Unset REQUIRE_AUTH to browse anonymously.",
    );
  }
  if (!token) {
    console.warn(
      "auth-browse: no ACCESS_TOKEN or login env; continuing as anonymous browse. Shared-user login is skipped.",
    );
  }

  const seed = http.get(
    `${API_BASE}/products?page=1&limit=24`,
    params("GET /products (seed)"),
  );
  if (seed.status !== 200) {
    fail(`Product seed request failed with status ${seed.status}`);
  }
  const products = extractProducts(seed);
  if (products.length === 0) {
    fail("No active products found. Seed the database before running auth-browse.");
  }

  return { products, token };
}

export default function authBrowse(data) {
  const token = data.token || "";
  const auth = token ? { Authorization: `Bearer ${token}` } : {};
  const product = randomItem(data.products);

  group("catalogue", () => {
    const response = http.get(
      `${API_BASE}/products?page=1&limit=24`,
      params("GET /products", { headers: auth }),
    );
    check(response, { "catalogue 200": (res) => res.status === 200 });
  });

  group("product", () => {
    const response = http.get(
      `${API_BASE}/products/${product.id}`,
      params("GET /products/:id", { headers: auth }),
    );
    check(response, { "product 200": (res) => res.status === 200 });
  });

  group("discovery", () => {
    const path = randomItem([
      "/categories/tree",
      "/brands?limit=24",
      "/recipes?limit=12",
    ]);
    const response = http.get(
      `${API_BASE}${path}`,
      params(`GET ${path.split("?")[0]}`, { headers: auth }),
    );
    check(response, { "discovery 200": (res) => res.status === 200 });
  });

  if (token) {
    group("session", () => {
      const me = http.get(
        `${API_BASE}/auth/me`,
        params("GET /auth/me", { headers: auth }),
      );
      check(me, { "me 200": (res) => res.status === 200 });

      const cart = http.get(
        `${API_BASE}/cart`,
        params("GET /cart", { headers: auth }),
      );
      check(cart, { "cart 200": (res) => res.status === 200 });
    });
  }

  sleep(THINK);
}
