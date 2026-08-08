/**
 * Rumera public smoke load test.
 *
 * Usage:
 *   k6 run load-tests/k6/smoke.js
 *   BASE_URL=https://staging.example.com VUS=10 DURATION=1m k6 run load-tests/k6/smoke.js
 */
import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = (__ENV.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const VUS = Number(__ENV.VUS || 5);
const DURATION = __ENV.DURATION || "30s";
const THINK = Number(__ENV.SLEEP || 1);

export const options = {
  vus: VUS,
  duration: DURATION,
  thresholds: {
    http_req_failed: ["rate<0.05"],
    http_req_duration: ["p(95)<2000"],
  },
};

const PATHS = ["/", "/products", "/brands", "/recipes", "/journal"];

export default function smoke() {
  const path = PATHS[Math.floor(Math.random() * PATHS.length)];
  const res = http.get(`${BASE_URL}${path}`, {
    tags: { name: path },
    redirects: 5,
  });
  check(res, {
    "status is 2xx/3xx": (r) => r.status >= 200 && r.status < 400,
  });
  sleep(THINK);
}
