/**
 * Shopper API journey: health → catalogue → product → optional cart add.
 *
 * Order placement is OFF by default so a casual run does not create orders.
 * Set CHECKOUT=1 only when you intend to place real orders against the target.
 *
 * Usage (read / optional cart only):
 *   k6 run load-tests/k6/checkout-journey.js
 *   ACCESS_TOKEN=... PRODUCT_VARIANT_ID=1 k6 run load-tests/k6/checkout-journey.js
 *
 * Login instead of a pre-minted token (still does not place orders):
 *   LOADTEST_EMAIL=load@example.com LOADTEST_PASSWORD=... \
 *     k6 run load-tests/k6/checkout-journey.js
 *
 * Place orders (mutates stock, cart, and orders — VUs default to 1):
 *   CHECKOUT=1 ACCESS_TOKEN=... ADDRESS_ID=1 SHIPPING_METHOD_ID=1 \
 *     PAYMENT_METHOD=card PRODUCT_VARIANT_ID=1 \
 *     k6 run load-tests/k6/checkout-journey.js
 *
 * Env:
 *   API_BASE, HEALTH_URL, ALLOW_REMOTE
 *   ACCESS_TOKEN              customer JWT (never commit)
 *   LOADTEST_EMAIL, LOADTEST_PASSWORD   public POST /auth/login if no token
 *   PRODUCT_VARIANT_ID        cart line; seeded from catalogue when omitted
 *   CHECKOUT                  1/true to POST /orders (default off)
 *   ADDRESS_ID, SHIPPING_METHOD_ID      required when CHECKOUT=1
 *   PAYMENT_METHOD            card|crypto|bank_transfer|wallet|gateway
 *                             default card (pending). wallet settles immediately
 *   REQUIRE_AUTH              1 = fail setup when no token/login
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
const CHECKOUT = envBool("CHECKOUT", false);
const REQUIRE_AUTH = envBool("REQUIRE_AUTH", false);
const ADDRESS_ID = Math.floor(envNumber("ADDRESS_ID", 0, 0));
const SHIPPING_METHOD_ID = Math.floor(envNumber("SHIPPING_METHOD_ID", 0, 0));
const PAYMENT_METHOD = __ENV.PAYMENT_METHOD || "card";
const VUS = Math.floor(envNumber("VUS", CHECKOUT ? 1 : 5, 1));
const DURATION = __ENV.DURATION || "30s";
const THINK = envNumber("SLEEP", 1, 0);

export const options = {
  vus: VUS,
  duration: DURATION,
  thresholds: {
    http_req_failed: ["rate<0.1"],
    http_req_duration: ["p(95)<4000"],
    checks: ["rate>0.95"],
  },
};

function params(name, extra = {}) {
  const { headers: extraHeaders, tags: extraTags, ...rest } = extra;
  return {
    headers: {
      Accept: "application/json",
      "User-Agent": "rumera-k6-checkout/1.0",
      "X-Load-Test": "rumera-checkout-journey",
      ...(extraHeaders || {}),
    },
    tags: { name, ...(extraTags || {}) },
    timeout: __ENV.REQUEST_TIMEOUT || "10s",
    ...rest,
  };
}

function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
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

function extractVariantId(response) {
  try {
    const body = response.json();
    const product = (body && body.data) || body || {};
    const variants = product.variants || [];
    const active = variants.find(
      (variant) => variant && variant.id && variant.is_active !== false,
    );
    return (active && active.id) || (variants[0] && variants[0].id) || 0;
  } catch (_) {
    return 0;
  }
}

function resolveToken() {
  const preset = __ENV.ACCESS_TOKEN || "";
  if (preset) return preset;

  const email = __ENV.LOADTEST_EMAIL || "";
  const password = __ENV.LOADTEST_PASSWORD || "";
  if (!email || !password) return "";

  const login = http.post(
    `${API_BASE}/auth/login`,
    JSON.stringify({ email, password }),
    params("POST /auth/login", {
      headers: { "Content-Type": "application/json" },
      tags: { endpoint: "login" },
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
      "ACCESS_TOKEN or LOADTEST_EMAIL+LOADTEST_PASSWORD is required when REQUIRE_AUTH=1. Unset REQUIRE_AUTH to browse without auth.",
    );
  }
  if (CHECKOUT && !token) {
    fail(
      "CHECKOUT=1 requires ACCESS_TOKEN or LOADTEST_EMAIL+LOADTEST_PASSWORD. Checkout stays off unless you opt in.",
    );
  }
  if (CHECKOUT && (!ADDRESS_ID || !SHIPPING_METHOD_ID)) {
    fail(
      "CHECKOUT=1 requires ADDRESS_ID and SHIPPING_METHOD_ID (owned by the same customer as the token).",
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
    fail("No active products found. Seed the database before running checkout-journey.");
  }

  let variantId = Math.floor(envNumber("PRODUCT_VARIANT_ID", 0, 0));
  if (!variantId) {
    const detail = http.get(
      `${API_BASE}/products/${products[0].id}`,
      params("GET /products/:id (seed)"),
    );
    variantId = extractVariantId(detail);
  }
  if ((CHECKOUT || (token && REQUIRE_AUTH)) && !variantId) {
    fail(
      "No PRODUCT_VARIANT_ID and none could be read from the catalogue. Pass PRODUCT_VARIANT_ID=…",
    );
  }

  return { products, token, variantId };
}

export default function checkoutJourney(data) {
  const token = data.token || "";
  const product = randomItem(data.products);

  group("health", () => {
    const response = http.get(HEALTH_URL, params("GET /health"));
    check(response, { "health 200": (res) => res.status === 200 });
  });

  group("catalogue", () => {
    const response = http.get(
      `${API_BASE}/products?page=1&limit=24`,
      params("GET /products"),
    );
    check(response, { "catalogue 200": (res) => res.status === 200 });
  });

  group("product", () => {
    const response = http.get(
      `${API_BASE}/products/${product.id}`,
      params("GET /products/:id"),
    );
    check(response, { "product 200": (res) => res.status === 200 });
  });

  let cartAccepted = false;
  if (token && data.variantId) {
    group("cart add", () => {
      const response = http.post(
        `${API_BASE}/cart/items`,
        JSON.stringify({
          product_variant_id: data.variantId,
          quantity: 1,
        }),
        params("POST /cart/items", {
          headers: {
            "Content-Type": "application/json",
            ...authHeaders(token),
          },
        }),
      );
      const added = response.status === 200 || response.status === 201;
      check(response, {
        "cart add accepted": (res) =>
          res.status === 200 || res.status === 201 || res.status === 409,
      });
      cartAccepted = added;
    });
  }

  if (CHECKOUT && token && cartAccepted) {
    group("place order", () => {
      const response = http.post(
        `${API_BASE}/orders`,
        JSON.stringify({
          address_id: ADDRESS_ID,
          shipping_method_id: SHIPPING_METHOD_ID,
          payment_method: PAYMENT_METHOD,
        }),
        params("POST /orders", {
          headers: {
            "Content-Type": "application/json",
            ...authHeaders(token),
            "Idempotency-Key": `k6-checkout-${__VU}-${__ITER}-${Date.now()}`,
          },
        }),
      );
      check(response, {
        "order created or conflict": (res) =>
          res.status === 201 ||
          res.status === 200 ||
          res.status === 409 ||
          res.status === 422,
      });
    });
  }

  sleep(THINK);
}
