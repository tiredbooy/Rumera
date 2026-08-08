/**
 * Mixed browse load: home + catalogue listing + sample product/recipe paths.
 *
 * Usage:
 *   BASE_URL=http://localhost:3000 VUS=20 DURATION=2m k6 run load-tests/k6/mixed.js
 */
import http from "k6/http";
import { check, group, sleep } from "k6";

const BASE_URL = (__ENV.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const VUS = Number(__ENV.VUS || 10);
const DURATION = __ENV.DURATION || "1m";
const THINK = Number(__ENV.SLEEP || 0.5);

export const options = {
  vus: VUS,
  duration: DURATION,
  thresholds: {
    http_req_failed: ["rate<0.08"],
    http_req_duration: ["p(95)<3000"],
  },
};

export default function mixed() {
  group("home", () => {
    const res = http.get(`${BASE_URL}/`);
    check(res, { "home ok": (r) => r.status < 400 });
  });

  group("catalogue", () => {
    const res = http.get(`${BASE_URL}/products`);
    check(res, { "products ok": (r) => r.status < 400 });
  });

  group("discovery", () => {
    const paths = ["/brands", "/recipes", "/search?q=rum"];
    const path = paths[Math.floor(Math.random() * paths.length)];
    const res = http.get(`${BASE_URL}${path}`);
    check(res, { "discovery ok": (r) => r.status < 400 });
  });

  sleep(THINK);
}
