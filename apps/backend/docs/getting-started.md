# Getting Started

## Prerequisites

- **Go** 1.25+
- **Docker** & Docker Compose (for the databases, Redis, and search)
- **[goose](https://github.com/pressly/goose)** for running migrations manually (optional — the app auto-migrates on boot)

## 1. Configuration

Configuration is loaded from environment variables (and a local `.env` file when present). Create `apps/backend/.env`:

```dotenv
# App
ENV=development
SERVER_PORT=8080

# Main database (PostgreSQL / TimescaleDB)
DB_HOST=localhost
DB_PORT=5432
DB_USER=rumera
DB_PASSWORD=rumera
DB_NAME=rumera
DB_SSL_MODE=disable

# Analytics database (TimescaleDB)
ANALYTICS_DB_HOST=localhost
ANALYTICS_DB_PORT=5433
ANALYTICS_DB_USER=rumera
ANALYTICS_DB_PASSWORD=rumera
ANALYTICS_DB_NAME=rumera_analytics
ANALYTICS_DB_SSL_MODE=disable

# Redis
REDIS_ADDR=localhost:6379
REDIS_PASSWORD=
REDIS_DB=0

# JWT — REQUIRED. Use a long random secret in production.
JWT_SECRET=change-me-to-a-32+char-random-secret
JWT_ACCESS_TTL=15      # minutes
JWT_REFRESH_TTL=10080  # minutes (7 days)

# CORS — comma-separated browser origins; "*" for development
CORS_ALLOWED_ORIGINS=*

# First-admin bootstrap — when both are set, an admin is created on first boot
# (no-op if the email already exists). Self-registration always yields a customer.
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=change-me-strong-password

# Payment gateway webhook — shared secret for HMAC signature verification
CRYPTO_WEBHOOK_KEY=whsec_change_me

# Gateway pay-start origin (PR-005a). Intents append ?transaction_id=<id>.
# Required in production. Empty in development leaves payment_url blank
# (does not fake a successful pay).
# PAYMENT_START_BASE_URL=https://pay.example.com/start

# SMTP — when SMTP_HOST is unset, email is logged instead of sent (dev mode)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=no-reply@example.com
```

> **Redis is required** for auth hardening (refresh-token rotation/revocation),
> login rate-limiting, and read-through caching. The app degrades gracefully
> without it (stateless refresh, no rate-limit, no cache), but production should
> run Redis.

> **Note:** `JWT_ACCESS_TTL` / `JWT_REFRESH_TTL` are in **minutes**. See [Authentication](./authentication.md).

A full list of variables (email/SMTP, storage, Meilisearch, crypto payments) lives in [`configs/config.go`](../configs/config.go).

## 2. Start the infrastructure

```bash
make docker-up      # postgres :5432, analytics :5433, redis :6379, meilisearch :7700
```

| Service | Image | Port |
|---------|-------|------|
| postgres (main) | `timescale/timescaledb:latest-pg17` | 5432 |
| analytics_db | `timescale/timescaledb:latest-pg17` | 5433 |
| redis | `redis:8-alpine` | 6379 |
| meilisearch | `getmeili/meilisearch:v1.15` | 7700 |

## 3. Migrations

The server **runs migrations automatically on startup** (see [`pkg/database/connect.go`](../pkg/database/connect.go)). To run them manually:

```bash
make migrate-all-up     # main + analytics
make migrate-status     # main DB status
make analytics-status   # analytics DB status
```

## 4. Run the server

```bash
make run                # go run ./cmd/server/main.go
# or
make build && ./bin/server
```

The API is now at `http://localhost:8080`. Verify:

```bash
curl http://localhost:8080/health
# {"data":{"status":"ok"}}
```

## 5. First request

```bash
# Register a customer
curl -X POST http://localhost:8080/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"jane@example.com","password":"supersecret"}'

# → { "data": { "access_token": "...", "refresh_token": "...", "user": {...} } }
```

Use the `access_token` as `Authorization: Bearer <token>` on protected routes.

## Useful Make targets

| Command | Description |
|---------|-------------|
| `make run` | Run the server |
| `make build` | Build binary to `bin/server` |
| `make test` | Run the test suite |
| `make tidy` | `go mod tidy` |
| `make docker-up` / `docker-down` | Start / stop infrastructure |
| `make migrate-all-up` / `migrate-all-down` | Apply / roll back all migrations |
