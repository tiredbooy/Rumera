# Rumera k6 load and capacity tests

This suite answers different questions with separate tests. Do not treat a
single virtual-user number as "maximum users"; idle users cost almost nothing,
while shoppers loading product pages create several backend requests.

## Test inventory

| Script                 | Purpose                               | Traffic model           | Mutates data? |
| ---------------------- | ------------------------------------- | ----------------------- | ------------- |
| `smoke.js`             | Quick public-page health check        | Fixed VUs               | No            |
| `mixed.js`             | Small frontend browse mix             | Fixed VUs               | No            |
| `capacity.js`          | Backend/API saturation and breakpoint | Open, staged journeys/s | No            |
| `frontend-capacity.js` | Next.js + gateway + backend capacity  | Open, staged journeys/s | No            |
| `cart-write.js`        | Authenticated cart write contention   | Fixed VUs               | Yes           |

The capacity tests use an **open arrival model**. The load generator starts
journeys at the requested rate even when the server slows down. That makes
latency growth, dropped journeys, and the saturation point visible instead of
quietly reducing throughput as a closed VU loop would.

## Prerequisites

- k6 installed (`k6 version`)
- a seeded environment with active products
- Grafana/Prometheus running when testing locally (`make dev-up`)
- permission to test the target

Run commands from the repository root so summaries land in
`load-tests/results/`.

## Recommended capacity workflow

Start small and run the layers independently:

```bash
# 1. Validate data, URLs, and checks (~20 seconds, negligible traffic).
PROFILE=smoke k6 run load-tests/k6/capacity.js

# 2. Locate normal API operating capacity (up to 50 journeys/s).
PROFILE=stress k6 run load-tests/k6/capacity.js

# 3. Push until the API breaks its SLO (up to 200 journeys/s).
PROFILE=breakpoint k6 run load-tests/k6/capacity.js

# 4. Measure the real storefront path, including Next.js SSR.
PROFILE=stress k6 run load-tests/k6/frontend-capacity.js

# 5. Test sudden traffic and recovery.
PROFILE=spike k6 run load-tests/k6/frontend-capacity.js

# 6. Find leaks, queue growth, and pool exhaustion over time.
PROFILE=soak SOAK_DURATION=30m k6 run load-tests/k6/capacity.js
```

Default local targets are:

- API: `http://localhost:8080/api/v1`
- frontend: `http://localhost:3000`
- health: derived as `http://localhost:8080/health`

To test the whole stack through nginx, point both paths at the gateway:

```bash
BASE_URL=http://localhost \
API_BASE=http://localhost/api/v1 \
PROFILE=stress \
k6 run load-tests/k6/frontend-capacity.js
```

Remote targets are blocked by default. For an environment you own and are
authorized to stress:

```bash
ALLOW_REMOTE=true \
BASE_URL=https://staging.example.com \
API_BASE=https://staging.example.com/api/v1 \
PROFILE=stress \
k6 run load-tests/k6/frontend-capacity.js
```

Do not run `stress`, `breakpoint`, `spike`, or write tests against production
without an approved test window, rate-limit review, rollback plan, and active
monitoring.

## Load profiles

Targets are **new user journeys per second**, not raw HTTP requests. An API
journey requests a catalogue page, product details and dependencies, and a
discovery endpoint. A frontend journey visits home, a listing/search page, and
a product page.

| Profile      | Sustained plateaus (journeys/s) | Use                        |
| ------------ | ------------------------------- | -------------------------- |
| `smoke`      | 1                               | Script/data validation     |
| `stress`     | 5, 10, 25, 50                   | Expected operating range   |
| `breakpoint` | 10, 25, 50, 100, 200            | Find hard saturation       |
| `spike`      | 5, sudden 100, recovery at 5    | Burst resilience           |
| `soak`       | 20 for 15m by default           | Leaks and slow degradation |

Scale every plateau without editing code:

```bash
# breakpoint now reaches 400 journeys/s
PROFILE=breakpoint RATE_SCALE=2 MAX_VUS=2000 \
k6 run load-tests/k6/capacity.js
```

If `dropped_iterations` is non-zero while the service metrics still look
healthy, k6 reached `MAX_VUS`; increase `PRE_ALLOCATED_VUS` and `MAX_VUS` or use
a larger, separate load-generator host. Do not run k6 on the same machine as
the application for a trustworthy production capacity number.

## SLOs and configuration

| Variable            |     API default |     Frontend default | Meaning                              |
| ------------------- | --------------: | -------------------: | ------------------------------------ |
| `P95_MS`            |            1000 |                 3000 | Maximum acceptable p95 latency       |
| `P99_MS`            |            2000 |                 6000 | Maximum acceptable p99 latency       |
| `MAX_ERROR_RATE`    |            0.01 |                 0.02 | Maximum failed-request/journey ratio |
| `PRE_ALLOCATED_VUS` |             100 |                  100 | VUs reserved by the generator        |
| `MAX_VUS`           |            1000 |                 1000 | Hard generator concurrency limit     |
| `THINK_MIN`         |            0.2s |                 0.5s | Minimum user pause                   |
| `THINK_MAX`         |            1.0s |                 2.0s | Maximum user pause                   |
| `REQUEST_TIMEOUT`   |             10s |                  15s | Per-request timeout                  |
| `RESULTS_FILE`      | API result JSON | frontend result JSON | Raw k6 summary path                  |

Set SLOs to actual product requirements before using the result for sizing.
Increasing timeouts or loosening thresholds does not increase real capacity; it
only changes what the test calls acceptable.

## Reading the result

Each capacity run prints a row per sustained `hold_*` plateau and saves the full
k6 summary as JSON. The capacity is the highest plateau where all of these are
true:

1. p95 and p99 are within the SLO.
2. HTTP and complete-journey error rates are within the SLO.
3. `dropped_iterations` is zero.
4. Throughput still rises with offered load.
5. The system recovers after the ramp or spike.
6. CPU/memory, DB pool, cache, and analytics queue have safe headroom.

While the run is active, open Grafana at `http://localhost:3001`. The Rumera
dashboard already shows request rate/errors/duration, DB pool utilization,
Redis cache outcomes, and analytics queue saturation. A common diagnosis is:

| Symptom                                   | Likely limit                                |
| ----------------------------------------- | ------------------------------------------- |
| CPU near 100%, pools healthy              | application/SSR compute                     |
| DB pool near 100%, latency climbs         | database concurrency or slow queries        |
| cache misses rise with DB load            | poor cache coverage or cold cache           |
| analytics queue stays near capacity       | event consumer/backpressure                 |
| k6 drops iterations, server stays healthy | load generator `MAX_VUS`/CPU/network        |
| frontend fails before direct API          | Next.js, nginx, or frontend-to-backend path |

Run the same profile at least three times. Report the median sustainable
plateau and keep 30–50% headroom; the first run may be colder than later runs.
Development mode is useful for diagnosis but not sizing—use optimized release
containers and production-like CPU, memory, DB volume, latency, and dataset.

## Converting capacity into “users”

There is no universal conversion from RPS to registered or daily users. Use
your observed product analytics:

```text
concurrently active users ≈ sustainable journeys/second × average journey cycle seconds
```

Example: if the last healthy plateau is 50 journeys/s and a real active shopper
starts one comparable journey every 30 seconds, that is roughly 1,500
concurrently active shoppers. It does **not** mean only 1,500 accounts or daily
users; logged-in but idle users generate almost no load. Validate the estimate
with real page views/session, session duration, cache hit ratio, geographic
latency, and read/write ratio.

## Authenticated cart writes

Writes are separate because they change a real user's cart and a single shared
token creates unrealistic lock contention:

```bash
ACCESS_TOKEN=eyJ... \
PRODUCT_VARIANT_ID=1 \
VUS=10 DURATION=2m \
k6 run load-tests/k6/cart-write.js
```

Use dedicated load-test users and test data. Never commit tokens. For meaningful
write capacity, use a separate token per VU/test user and clean up carts after
the run; the current cart script remains a contention probe rather than a full
checkout capacity benchmark.

## Quick legacy checks

```bash
k6 run load-tests/k6/smoke.js

BASE_URL=https://staging.example.com VUS=20 DURATION=2m \
k6 run load-tests/k6/mixed.js
```
