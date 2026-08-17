/**
 * Optional authenticated cart write path.
 * Requires a real customer ACCESS_TOKEN (never commit secrets).
 *
 * Usage:
 *   ACCESS_TOKEN=... PRODUCT_VARIANT_ID=1 k6 run load-tests/k6/cart-write.js
 *   REQUIRE_AUTH=1 ACCESS_TOKEN=... PRODUCT_VARIANT_ID=1 \
 *     k6 run load-tests/k6/cart-write.js
 *
 * When ACCESS_TOKEN is missing the script skips writes and only checks the
 * unauthenticated storefront (safe default). REQUIRE_AUTH=1 fails setup
 * instead of that fallback.
 *
 * One shared token means every VU contends on the same cart — a lock probe,
 * not multi-shopper write capacity.
 */
import http from "k6/http";
import { check, fail, sleep } from "k6";

import {
  envBool,
  envNumber,
  requireLoadTestPermission,
  withoutTrailingSlash,
} from "./lib/config.js";

const BASE_URL = withoutTrailingSlash(__ENV.BASE_URL || "http://localhost:3000");
const TOKEN = __ENV.ACCESS_TOKEN || "";
const VARIANT_ID = Math.floor(envNumber("PRODUCT_VARIANT_ID", 0, 0));
const REQUIRE_AUTH = envBool("REQUIRE_AUTH", false);
const VUS = Math.floor(envNumber("VUS", 3, 1));
const DURATION = __ENV.DURATION || "20s";

export const options = {
  vus: VUS,
  duration: DURATION,
  thresholds: {
    http_req_failed: ["rate<0.1"],
    http_req_duration: ["p(95)<4000"],
  },
};

export function setup() {
  requireLoadTestPermission(BASE_URL);
  if (TOKEN) {
    requireLoadTestPermission(
      withoutTrailingSlash(__ENV.API_BASE || `${BASE_URL}/api/store`),
    );
  }
  if (REQUIRE_AUTH && !TOKEN) {
    fail(
      "ACCESS_TOKEN is required when REQUIRE_AUTH=1. Export a customer JWT from a dedicated load-test account (never commit secrets). Unset REQUIRE_AUTH to use the public browse fallback.",
    );
  }
  if (!TOKEN) {
    console.warn(
      "cart-write: ACCESS_TOKEN not set — skipping cart writes and browsing the public storefront.",
    );
  } else if (!VARIANT_ID) {
    console.warn(
      "cart-write: PRODUCT_VARIANT_ID missing — skipping cart writes (browse fallback).",
    );
  }
  return { write: Boolean(TOKEN && VARIANT_ID) };
}

export default function cartWrite(data) {
  if (!data.write) {
    const res = http.get(`${BASE_URL}/products`);
    check(res, { "browse fallback ok": (r) => r.status < 400 });
    sleep(1);
    return;
  }

  // Prefer Go API when API_BASE is set; otherwise hit the Next BFF.
  const apiBase = withoutTrailingSlash(
    __ENV.API_BASE || `${BASE_URL}/api/store`,
  );

  const res = http.post(
    `${apiBase}/cart/items`,
    JSON.stringify({
      product_variant_id: VARIANT_ID,
      quantity: 1,
    }),
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TOKEN}`,
      },
      tags: { name: "POST /cart/items" },
    },
  );

  check(res, {
    "cart add accepted": (r) =>
      REQUIRE_AUTH
        ? r.status === 200 || r.status === 201 || r.status === 409
        : r.status === 200 ||
          r.status === 201 ||
          r.status === 401 ||
          r.status === 409,
  });
  sleep(1);
}
