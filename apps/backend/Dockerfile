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

# build-base + vips-dev: the image pipeline uses libvips (cgo) under the `vips`
# build tag for AVIF/WebP/JPEG/PNG transforms. Alpine 3.22+ splits HEIF and
# its AV1 codec into plugins, so both are explicit build dependencies.
RUN apk add --no-cache git build-base vips-dev vips-heif libheif-aom

# Module proxy is overridable so builds behind a region-restricted network can
# point at a reachable mirror (e.g. --build-arg GOPROXY=https://<mirror>,direct).
ARG GOPROXY=https://proxy.golang.org,direct
ARG GOSUMDB=sum.golang.org
ENV GOPROXY=${GOPROXY} GOSUMDB=${GOSUMDB}

# Download modules first — cached until go.mod/go.sum change.
COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod \
    go mod download

COPY . .

# Dynamically linked against libvips (CGO on); built with the `vips` tag so the
# libvips transformer is compiled in. Stripped + trimmed for a lean binary.
ENV CGO_ENABLED=1 GOOS=linux
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    go build -trimpath -tags vips -ldflags="-s -w" -o /app/server ./cmd/server/main.go \
 && go build -trimpath -tags vips -ldflags="-s -w" -o /app/media-reconcile ./cmd/media-reconcile \
 && go build -trimpath -tags vips -ldflags="-s -w" -o /app/event-worker ./cmd/event-worker

# ── runner ────────────────────────────────────────────────────────────────────
FROM alpine:3.21 AS runner
WORKDIR /app

# TLS roots for outbound calls; wget (busybox) powers the healthcheck; vips is
# the libvips runtime the cgo binary links against. /data holds uploaded
# originals + the rendered cache and must be writable by the unprivileged user
# (a fresh named volume inherits this ownership on first mount).
RUN apk add --no-cache ca-certificates tzdata vips vips-heif \
 && addgroup --system --gid 1001 rumera \
 && adduser --system --uid 1001 --ingroup rumera rumera \
 && mkdir -p /data/media /data/media-cache \
 && chown -R rumera:rumera /data

# Binary + migrations only. No .env, no source.
COPY --from=builder --chown=rumera:rumera /app/server ./server
COPY --from=builder --chown=rumera:rumera /app/media-reconcile ./media-reconcile
# Same image, different entrypoint: docker-compose.prod.yml runs ./event-worker.
COPY --from=builder --chown=rumera:rumera /app/event-worker ./event-worker
COPY --from=builder --chown=rumera:rumera /app/migrations ./migrations

USER rumera

EXPOSE 8080

# Liveness probe against the cheap /health endpoint.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${SERVER_PORT:-8080}/health" >/dev/null 2>&1 || exit 1

ENTRYPOINT ["./server"]
