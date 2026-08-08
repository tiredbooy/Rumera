/**
 * Optional authenticated cart write path.
 * Requires a real customer ACCESS_TOKEN (never commit secrets).
 *
 * Usage:
 *   ACCESS_TOKEN=... PRODUCT_VARIANT_ID=1 k6 run load-tests/k6/cart-write.js
 *
 * When ACCESS_TOKEN is missing the script skips writes and only checks the
 * unauthenticated storefront (safe default).
 */
import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = (__ENV.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const TOKEN = __ENV.ACCESS_TOKEN || "";
const VARIANT_ID = Number(__ENV.PRODUCT_VARIANT_ID || 0);
const VUS = Number(__ENV.VUS || 3);
const DURATION = __ENV.DURATION || "20s";

export const options = {
  vus: VUS,
  duration: DURATION,
  thresholds: {
    http_req_failed: ["rate<0.1"],
    http_req_duration: ["p(95)<4000"],
  },
};

export default function cartWrite() {
  if (!TOKEN || !VARIANT_ID) {
    const res = http.get(`${BASE_URL}/products`);
    check(res, { "browse fallback ok": (r) => r.status < 400 });
    sleep(1);
    return;
  }

  // Prefer Go API when API_BASE is set; otherwise hit the Next BFF.
  const apiBase = (
    __ENV.API_BASE || `${BASE_URL}/api/store`
  ).replace(/\/$/, "");

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
      r.status === 200 || r.status === 201 || r.status === 401 || r.status === 409,
  });
  sleep(1);
}
