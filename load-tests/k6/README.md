# Rumera k6 load and capacity tests

This suite answers different questions with separate tests. Do not treat a
single virtual-user number as "maximum users"; idle users cost almost nothing,
while shoppers loading product pages create several backend requests.

## Founder runbook

Run every command from the **repository root** so JSON summaries land in
`load-tests/results/`. Install k6 first (`k6 version`). Point at a seeded local
or staging stack you own. **Do not run `breakpoint` (or any heavy profile) on
the same machine as the app** — the generator and the API will fight for CPU
and the number will be a lie.

Remote hosts are blocked unless you set `ALLOW_REMOTE=true` on a target you
own and are authorized to stress. Never commit tokens, emails, or passwords.

### Which script, what it measures

| Question you want answered | Script | Mutates? | Typical command |
| -------------------------- | ------ | -------- | --------------- |
| Is the storefront even up? | `smoke.js` | No | `k6 run load-tests/k6/smoke.js` |
| How do a few shoppers feel on Next.js pages? | `mixed.js` | No | `VUS=20 DURATION=2m k6 run load-tests/k6/mixed.js` |
| How many **browse journeys/s** can the Go API hold? | `capacity.js` | No | `PROFILE=stress k6 run load-tests/k6/capacity.js` |
| Does Next.js / nginx fail **before** the API? | `frontend-capacity.js` | No | `PROFILE=stress k6 run load-tests/k6/frontend-capacity.js` |
| How does `GET /products?search=` behave (Persian + Latin)? | `search.js` | No | `PROFILE=smoke k6 run load-tests/k6/search.js` |
| Login (optional) + authenticated browse | `auth-browse.js` | No | `LOADTEST_EMAIL=… LOADTEST_PASSWORD=… k6 run load-tests/k6/auth-browse.js` |
| Cart add contention on **one** customer | `cart-write.js` | Yes | `ACCESS_TOKEN=… PRODUCT_VARIANT_ID=1 k6 run load-tests/k6/cart-write.js` |
| Health → catalogue → product → cart; **orders only if you opt in** | `checkout-journey.js` | Cart yes; orders only with `CHECKOUT=1` | `k6 run load-tests/k6/checkout-journey.js` |
| Admin product + order lists (read only) | `admin-read.js` | No | `ADMIN_ACCESS_TOKEN=… k6 run load-tests/k6/admin-read.js` |

Suggested first hour:

```bash
# 1. Public pages, almost no load.
k6 run load-tests/k6/smoke.js

# 2. API search + browse (open model, 1 journey/s).
PROFILE=smoke k6 run load-tests/k6/search.js
PROFILE=smoke k6 run load-tests/k6/capacity.js

# 3. Optional login browse (or omit env to stay anonymous).
LOADTEST_EMAIL=loadtest@example.com LOADTEST_PASSWORD='…' \
  k6 run load-tests/k6/auth-browse.js

# 4. Storefront vs API — only after smoke is green.
PROFILE=stress k6 run load-tests/k6/capacity.js
PROFILE=stress k6 run load-tests/k6/frontend-capacity.js

# 5. Find the cliff. Use a *separate* load-generator host.
PROFILE=breakpoint k6 run load-tests/k6/capacity.js
```

Writes are a later, deliberate step:

```bash
# Fail loud if the token is missing (no silent browse fallback).
REQUIRE_AUTH=1 ACCESS_TOKEN=eyJ... PRODUCT_VARIANT_ID=1 \
  k6 run load-tests/k6/cart-write.js

# Cart add only. Does *not* create orders.
ACCESS_TOKEN=eyJ... k6 run load-tests/k6/checkout-journey.js

# Creates real orders. Default VUs=1. Do not casually enable this.
CHECKOUT=1 ACCESS_TOKEN=eyJ... ADDRESS_ID=1 SHIPPING_METHOD_ID=1 \
  PAYMENT_METHOD=card VUS=1 DURATION=30s \
  k6 run load-tests/k6/checkout-journey.js
```

### How to read “how many users”

`PROFILE=stress` plateaus are **new journeys per second**, not “50 humans
online.” A capacity journey is several HTTP calls (catalogue + product +
discovery). Convert with your own analytics:

```text
concurrently active shoppers ≈ sustainable journeys/s × seconds between journeys
```

Example: last healthy plateau is 50 journeys/s and a real shopper starts one
comparable journey every 30 s → about **1,500 concurrently active** shoppers.
That is not 1,500 registered accounts and not 1,500 daily users. Idle logged-in
people generate almost no load.

k6 `VUS=20` on `smoke.js` / `mixed.js` means 20 closed loops, not 20 real
customers. If `dropped_iterations` is non-zero while Grafana still looks
healthy, the **generator** ran out of VUs — raise `MAX_VUS` or use a bigger
load box.

### Do not

- Do **not** run `breakpoint`, `spike`, or soak on the laptop that also runs
  Docker/Postgres/Next.js. Capacity numbers from a shared box are not
  production sizing.
- Do **not** run `CHECKOUT=1` or `PAYMENT_METHOD=wallet` against a dataset you
  care about without a cleanup plan. Wallet settles (debits) in the create TX.
- Do **not** treat a single shared `ACCESS_TOKEN` as write capacity — every VU
  fights one cart. See remaining work (token file) in
  `refactor-workstreams/event-driven-and-capacity/findings-k6.md`.
- Do **not** hit production without an approved window, rate-limit review,
  rollback plan, and someone watching Grafana.

Default local targets: API `http://localhost:8080/api/v1`, frontend
`http://localhost:3000`, health `http://localhost:8080/health`. Grafana is
`http://localhost:3001` when `make dev-up` is running.

---

## Test inventory

| Script                  | Purpose                                      | Traffic model           | Mutates data?      |
| ----------------------- | -------------------------------------------- | ----------------------- | ------------------ |
| `smoke.js`              | Quick public-page health check               | Fixed VUs               | No                 |
| `mixed.js`              | Small frontend browse mix                    | Fixed VUs               | No                 |
| `capacity.js`           | Backend/API saturation and breakpoint        | Open, staged journeys/s | No                 |
| `frontend-capacity.js`  | Next.js + gateway + backend capacity         | Open, staged journeys/s | No                 |
| `search.js`             | `GET /products?search=` (Persian + Latin)    | Open, staged journeys/s | No                 |
| `auth-browse.js`        | Optional login + API browse                  | Fixed VUs               | No                 |
| `admin-read.js`         | `GET /admin/products`, `GET /admin/orders`   | Open, staged journeys/s | No                 |
| `cart-write.js`         | Authenticated cart write contention          | Fixed VUs               | Yes (cart)         |
| `checkout-journey.js`   | Health → catalogue → product → optional cart | Fixed VUs               | Cart; orders opt-in |

The capacity tests (`capacity`, `frontend-capacity`, `search`, `admin-read`)
use an **open arrival model**. The load generator starts journeys at the
requested rate even when the server slows down. That makes latency growth,
dropped journeys, and the saturation point visible instead of quietly reducing
throughput as a closed VU loop would.

## Prerequisites

- k6 installed (`k6 version`)
- a seeded environment with active products
- Grafana/Prometheus running when testing locally (`make dev-up`)
- permission to test the target
- dedicated load-test users if you exercise login, cart, checkout, or admin

Run commands from the repository root so summaries land in
`load-tests/results/`.

## Recommended capacity workflow

Start small and run the layers independently:

```bash
# 1. Validate data, URLs, and checks (~20 seconds, negligible traffic).
PROFILE=smoke k6 run load-tests/k6/capacity.js
PROFILE=smoke k6 run load-tests/k6/search.js

# 2. Locate normal API operating capacity (up to 50 journeys/s).
PROFILE=stress k6 run load-tests/k6/capacity.js

# 3. Push until the API breaks its SLO (up to 200 journeys/s).
#    Use a separate load-generator host — not the app machine.
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
a product page. Search is one `GET /products?search=` per journey. Admin read
is products list + orders list.

Used by `capacity.js`, `frontend-capacity.js`, `search.js`, and
`admin-read.js`. `search` and `admin-read` default to `PROFILE=smoke`.

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

Shared env for every API script:

| Variable                 | Meaning |
| ------------------------ | ------- |
| `API_BASE`               | Go API root (default `http://localhost:8080/api/v1`) |
| `BASE_URL`               | Next.js origin (default `http://localhost:3000`) |
| `HEALTH_URL`             | Override derived `/health` |
| `ALLOW_REMOTE`           | Must be true/1 to hit a non-local host |
| `ACCESS_TOKEN`           | Customer JWT — never commit |
| `ADMIN_ACCESS_TOKEN`     | Staff JWT for `admin-read.js` — never commit |
| `LOADTEST_EMAIL`         | Public `POST /auth/login` (setup only) |
| `LOADTEST_PASSWORD`      | Public login password — never commit |
| `REQUIRE_AUTH`           | Fail setup instead of anonymous/browse fallback |
| `REQUIRE_ADMIN`          | Fail `admin-read.js` instead of skipping |
| `PRODUCT_VARIANT_ID`     | Cart line for write scripts |
| `CHECKOUT`               | `1` enables `POST /orders` in `checkout-journey.js` (default off) |
| `ADDRESS_ID`             | Required when `CHECKOUT=1` |
| `SHIPPING_METHOD_ID`     | Required when `CHECKOUT=1` |
| `PAYMENT_METHOD`         | `card` (pending, default) or `wallet` (settles immediately) |
| `SEARCH_TERMS`           | Comma-separated terms for `search.js` / `capacity.js` |

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

## Authenticated scripts

Writes change a real user's cart. A single shared token creates unrealistic
lock contention. Login is rate-limited (~10/min/IP), so `auth-browse.js` and
`checkout-journey.js` log in **once in setup**, then share that JWT.

```bash
# Shared-user browse (documented contention on GET /cart + GET /auth/me).
LOADTEST_EMAIL=loadtest@example.com LOADTEST_PASSWORD='…' \
  k6 run load-tests/k6/auth-browse.js

# Or skip login entirely and pass a token minted out-of-band.
ACCESS_TOKEN=eyJ... k6 run load-tests/k6/auth-browse.js

# Anonymous browse is the default when neither token nor login env is set.
k6 run load-tests/k6/auth-browse.js

# Cart writes — silent public fallback without a token.
ACCESS_TOKEN=eyJ... PRODUCT_VARIANT_ID=1 \
  VUS=10 DURATION=2m \
  k6 run load-tests/k6/cart-write.js

# Cart writes — fail setup if the token is missing.
REQUIRE_AUTH=1 ACCESS_TOKEN=eyJ... PRODUCT_VARIANT_ID=1 \
  k6 run load-tests/k6/cart-write.js

# Admin lists only. Skips (does not fail) without ADMIN_ACCESS_TOKEN.
ADMIN_ACCESS_TOKEN=eyJ... PROFILE=smoke \
  k6 run load-tests/k6/admin-read.js
```

Use dedicated load-test users and test data. Never commit tokens. For
meaningful write capacity, use a separate token per VU/test user and clean up
carts after the run; the current cart script remains a contention probe rather
than a full checkout capacity benchmark.

### Checkout opt-in

`checkout-journey.js` always does health → catalogue → product. With
`ACCESS_TOKEN` (or login env) it also `POST /cart/items`. It **does not**
`POST /orders` unless every one of these is set:

- `CHECKOUT=1`
- a customer token (or successful login)
- `ADDRESS_ID` and `SHIPPING_METHOD_ID` belonging to that customer

`PAYMENT_METHOD` defaults to `card` (pending payment row, no wallet debit).
`wallet` settles in the create transaction. Default `VUS=1` when checkout is
on so one shared cart is not emptied out from under other VUs.

## Quick legacy checks

```bash
k6 run load-tests/k6/smoke.js

BASE_URL=https://staging.example.com ALLOW_REMOTE=true VUS=20 DURATION=2m \
  k6 run load-tests/k6/mixed.js
```
