# Findings — k6 suite

**Workstream:** `event-driven-capacity-20260816`  
**Agent:** `k6-suite`  
**Date:** 2026-08-16  
**Mode:** implementation (load-test scripts + runbook only; no application Go/TS)

---

## K6-000 — Runnable suite (done)

Shipped complete scripts the founder can run later. Existing
`smoke` / `mixed` / `capacity` / `frontend-capacity` were left as-is except
`cart-write` hardening and a backward-compatible `loadProfile(defaultName)`
argument in `load-tests/k6/lib/config.js` (capacity still defaults to
`stress`).

| Path | What it does |
| ---- | ------------ |
| `load-tests/k6/checkout-journey.js` | API path: health → `GET /products` → `GET /products/:id` → optional `POST /cart/items` when a customer token exists. `POST /orders` only when `CHECKOUT=1` **and** token **and** `ADDRESS_ID` + `SHIPPING_METHOD_ID`. Default `PAYMENT_METHOD=card` (pending). `wallet` settles immediately. Default `VUS=1` when checkout is on. Login via `LOADTEST_EMAIL` + `LOADTEST_PASSWORD` if no `ACCESS_TOKEN`. |
| `load-tests/k6/auth-browse.js` | Setup login once (rate-limit safe) when email+password set; else `ACCESS_TOKEN`; else anonymous browse. Then catalogue + product + discovery; `GET /auth/me` + `GET /cart` when authenticated. Documents single-user contention. |
| `load-tests/k6/search.js` | `GET /products?search=` with Latin + Persian default terms. Open arrival via `PROFILE` (default `smoke`). |
| `load-tests/k6/admin-read.js` | Read-only `GET /admin/products` + `GET /admin/orders`. Skips (1 no-op iteration) without `ADMIN_ACCESS_TOKEN`. `REQUIRE_ADMIN=1` fails setup instead. |
| `load-tests/k6/cart-write.js` | `REQUIRE_AUTH=1` fails setup with a clear message if `ACCESS_TOKEN` is missing. Safe public browse fallback otherwise. `REQUIRE_AUTH=1` no longer treats HTTP 401 as a passing cart write. |
| `load-tests/k6/README.md` | Founder runbook: which script, what it measures, example commands, how to read “how many users”, do not run breakpoint on the app machine. Env table for the new scripts. |
| `load-tests/k6/lib/config.js` | `loadProfile(defaultName = "stress")` so search/admin can default to smoke without changing capacity. |

**Not added:** Makefile targets. Root `Makefile` (and every other Makefile)
has no existing load-test / k6 targets. Extending would invent a second
system.

**Not run against a live stack this session** (charter: do not hit remote
URLs). `k6` is not installed on this agent host (`k6 version` / `which k6`
missed). Syntax-checked every script with `node --check` (parse only; k6
imports are not executed). Founder machine should run
`k6 inspect load-tests/k6/smoke.js` (and the new scripts) after `k6` is
installed.

Secrets: no tokens, emails, or passwords are committed. Scripts only read
them from env.

---

## Remaining tasks (not implemented here)

### K6-001 — Run the suite on staging

Execute smoke → search → capacity stress → frontend-capacity on a seeded
staging host from a **separate** load-generator box (`ALLOW_REMOTE=true`).
Record plateau table + Grafana notes. This session did not hit remotes.

### K6-002 — Multi-user token file

`ACCESS_TOKEN` / login is one shared customer. Cart and checkout therefore
measure lock contention, not N-shopper write capacity. Add something like
`TOKEN_FILE` (one JWT per line, VU `i` uses line `i % n`) plus a seed/cleanup
path. Do not commit the file.

### K6-003 — Checkout write remains default-off

`CHECKOUT=1` is implemented and documented, but there is no dedicated
open-model / breakpoint profile for `POST /orders`. Keep default off. A
future write-capacity job should require a token file (K6-002), `VUS`/arrival
caps, and a cleanup playbook (pending orders, reserved stock, wallet debit).

---

## How a founder runs it (short)

See `load-tests/k6/README.md` (Founder runbook). Minimum:

```bash
k6 run load-tests/k6/smoke.js
PROFILE=smoke k6 run load-tests/k6/search.js
PROFILE=smoke k6 run load-tests/k6/capacity.js
```
