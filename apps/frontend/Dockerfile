# syntax=docker/dockerfile:1.7

# ──────────────────────────────────────────────────────────────────────────────
# Rumera storefront — PRODUCTION image
#
# Multi-stage build that produces a tiny, secure runtime:
#   deps    → install node_modules with a cached, reproducible npm ci
#   builder → next build with output:"standalone" (traces only what's needed)
#   runner  → distroless-ish alpine, non-root, just the standalone server
#
# Final image carries no source, no dev deps, and no full node_modules — only
# the traced server bundle + static assets. Starts with `node server.js`.
# ──────────────────────────────────────────────────────────────────────────────

# ── deps ──────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app

# libc compat for some native deps; safe no-op otherwise.
RUN apk add --no-cache libc6-compat

# Install against the lockfile only — this layer is cached until deps change.
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci

# ── builder ───────────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

# Public site URL is inlined into the build (NEXT_PUBLIC_*), so it must be known
# at build time. Override with: --build-arg NEXT_PUBLIC_SITE_URL=https://...
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
ENV NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

# ── runner ────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Run as an unprivileged user.
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# Standalone output: the server + only the node_modules it traced.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs

EXPOSE 3000

# Liveness: the home route must answer 200.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
