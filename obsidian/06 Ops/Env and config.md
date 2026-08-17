---
tags: [ops]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 06 Ops]]


# Env and config

Living encyclopedia of important variables. Source of truth in code: `apps/backend/configs/config.go` + frontend `.env*` examples. Always re-check after config changes.

## Backend — app & HTTP

| Variable | Role |
|----------|------|
| `ENV` | development / production behavior |
| `SERVER_PORT` | API listen port (default 8080) |
| `CORS_ALLOWED_ORIGINS` | Browser origins (prod: explicit) |
| `TRUSTED_PROXIES` | Ingress CIDRs trusted for `X-Forwarded-For` / `c.ClientIP()`. **Required in production** (`Validate()` fails boot if empty). Compose default `172.16.0.0/12` (Docker user-defined bridge; nginx → backend). Do not set `0.0.0.0/0` — that re-opens XFF spoofing of login/OTP/global rate limits. |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Bootstrap admin on first boot |

## Backend — data stores

| Variable | Role |
|----------|------|
| `DB_HOST` `DB_PORT` `DB_USER` `DB_PASSWORD` `DB_NAME` `DB_SSL_MODE` | Main Postgres |
| `ANALYTICS_DB_*` | Analytics / Timescale |
| `REDIS_ADDR` `REDIS_PASSWORD` `REDIS_DB` | Cache |
| `CACHE_BREAKER_THRESHOLD` `CACHE_BREAKER_COOLDOWN` | Redis circuit breaker |
| `DB_RETRY_MAX_ATTEMPTS` `DB_RETRY_BASE_BACKOFF` | Transient SQL retries |
| `MEILI_ENABLED` `MEILI_HOST` `MEILI_API_KEY` `MEILI_INDEX_UID` | Meili readiness (default off; search still ILIKE) |
| `CRON_MEILI_REINDEX_SCHEDULE` | Full products index rebuild when Meili client up |
| `LOYALTY_EARN_DIVISOR` `LOYALTY_REDEEM_VALUE` `LOYALTY_SIGNUP_BONUS` `LOYALTY_REFERRAL_REWARD` | Cellar Club rates (live) |
| `LOYALTY_REVIEW_BONUS` `LOYALTY_BIRTHDAY_BONUS` `LOYALTY_BIRTHDAY_TZ` | Live PH-040b — see [[Loyalty Backend]] |
| `CRON_LOYALTY_BIRTHDAY_SCHEDULE` | Daily birthday awards job |

## Backend — auth & security

| Variable | Role |
|----------|------|
| `JWT_SECRET` | Required |
| `JWT_ACCESS_TTL` | Access minutes (default 15) |
| `JWT_REFRESH_TTL` | Refresh minutes (default 7d) |
| `CRYPTO_WEBHOOK_KEY` | Payment webhook HMAC; **required in production** |
| `PAYMENT_START_BASE_URL` | Gateway pay-start origin; intents append `?transaction_id=` ([[Payments]] · PR-005a). **Required in production**; empty in dev leaves `payment_url` blank (does not fake pay) |

## Backend — media

| Variable | Role |
|----------|------|
| `MEDIA_MAX_UPLOAD_MB` | Upload size cap |
| `MEDIA_DEFAULT_QUALITY` | Default transform quality |
| `MEDIA_MAX_DIMENSION` | Max request w/h |
| `MEDIA_MAX_SOURCE_DIMENSION` / `MEDIA_MAX_SOURCE_PIXELS` | Bomb guards |

## Backend — notifications & messaging

| Variable | Role |
|----------|------|
| `NOTIFICATIONS_MODE` | `inline` \| `async` |
| `KAFKA_BROKERS` | Async bus |
| `NOTIFICATION_WORKER_MODE` | `all` \| `relay` \| `consume` \| `log` |
| `SMTP_*` | Email |
| `SMS_*` / OTP envs | SMS provider, OTP TTL |

## Backend — commerce knobs

| Variable | Role |
|----------|------|
| `LOYALTY_EARN_DIVISOR` | Points earn scaling |
| `LOYALTY_REDEEM_VALUE` | Redeem economics |
| `LOYALTY_SIGNUP_BONUS` | Signup points |
| Referral reward | Wired via loyalty/referral bootstrap (see code) |

## Frontend

| Variable | Role |
|----------|------|
| `NEXT_PUBLIC_SITE_URL` | Canonical site / metadata |
| `NEXT_PUBLIC_API_URL` | Public API origin for RSC |
| `API_URL` | Server-side API (may differ in Docker) |
| `NEXT_PUBLIC_MEDIA_BASE_URL` | Media origin override. Also feeds `images.remotePatterns` with `NEXT_PUBLIC_API_URL` (PR-090c). |
| `AUTH_SECRET` `AUTH_URL` | Auth.js session signing + callback origin. Prod compose injects both into the **frontend** service (`${AUTH_SECRET:?…}`, `${AUTH_URL:?…}`). Not the same as backend `JWT_SECRET`. |
| `PROMETHEUS_URL` | Admin monitoring |
| `NEXT_PUBLIC_GRAFANA_URL` | Grafana link |
| `NEXT_PUBLIC_PWA` | Force PWA flags in dev |

## Templates

- Monorepo: `.env.example`, `.env.dev.example`, `.env.prod.example`
- Frontend may have local `.env*`

## Related

[[Docker and Local Dev]] · [[Gateway and nginx]] · [[Playbook Debug Webhook]] · [[Notifications]] · [[Media and Cache FE]] · [[Migrations]]

#ops
