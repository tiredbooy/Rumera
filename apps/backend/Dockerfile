# syntax=docker/dockerfile:1.7

# ──────────────────────────────────────────────────────────────────────────────
# Rumera backend — PRODUCTION image
#
# Multi-stage, statically linked Go binary on a minimal, non-root Alpine runtime.
#   builder → CGO-free static build with cached module + build caches
#   runner  → ca-certs + the binary + migrations only; runs as an unprivileged
#             user with a built-in healthcheck.
#
# Configuration is supplied at RUNTIME via environment variables (see the root
# docker-compose.prod.yml / .env) — never baked into the image.
# ──────────────────────────────────────────────────────────────────────────────

# ── builder ───────────────────────────────────────────────────────────────────
FROM golang:1.25-alpine AS builder
WORKDIR /app

RUN apk add --no-cache git

# Download modules first — cached until go.mod/go.sum change.
COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod \
    go mod download

COPY . .

# Static, stripped, reproducible binary. CGO off so it runs on a bare runtime.
ENV CGO_ENABLED=0 GOOS=linux
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    go build -trimpath -ldflags="-s -w" -o /app/server ./cmd/server/main.go

# ── runner ────────────────────────────────────────────────────────────────────
FROM alpine:3.21 AS runner
WORKDIR /app

# TLS roots for outbound calls; wget (busybox) powers the healthcheck.
RUN apk add --no-cache ca-certificates tzdata \
 && addgroup --system --gid 1001 rumera \
 && adduser --system --uid 1001 --ingroup rumera rumera

# Binary + migrations only. No .env, no source.
COPY --from=builder --chown=rumera:rumera /app/server ./server
COPY --from=builder --chown=rumera:rumera /app/migrations ./migrations

USER rumera

EXPOSE 8080

# Liveness probe against the cheap /health endpoint.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${SERVER_PORT:-8080}/health" >/dev/null 2>&1 || exit 1

ENTRYPOINT ["./server"]
