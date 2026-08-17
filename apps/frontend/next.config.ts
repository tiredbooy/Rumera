import type { NextConfig } from "next";

type ImageRemotePattern = NonNullable<
  NonNullable<NextConfig["images"]>["remotePatterns"]
>[number];

/**
 * Build `images.remotePatterns` from the configured media/API origins.
 * Same-origin `/media` (empty env, typical nginx prod) needs no entries.
 * Never emit `*` / `**` — that turns the optimizer into an open HTTPS proxy.
 */
function imageRemotePatternsFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): ImageRemotePattern[] {
  const seen = new Set<string>();
  const patterns: ImageRemotePattern[] = [];

  for (const raw of [
    env.NEXT_PUBLIC_MEDIA_BASE_URL,
    env.NEXT_PUBLIC_API_URL,
  ]) {
    const trimmed = raw?.trim();
    if (!trimmed) continue;

    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      continue;
    }

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      continue;
    }

    const hostname = parsed.hostname;
    if (!hostname || hostname.includes("*")) {
      continue;
    }

    const protocol = parsed.protocol === "https:" ? "https" : "http";
    const port = parsed.port;
    const key = `${protocol}://${hostname}${port ? `:${port}` : ""}`;
    if (seen.has(key)) continue;
    seen.add(key);

    patterns.push({
      protocol,
      hostname,
      ...(port ? { port } : {}),
    });
  }

  return patterns;
}

/**
 * Rumera storefront — Next.js configuration.
 *
 * Tuned for a fast, production-grade e-commerce front end:
 *  - `output: "standalone"` so the Docker image ships only the traced server +
 *    a minimal `node_modules`, keeping the prod image small and cold-starts low.
 *  - Aggressive icon/animation tree-shaking via `optimizePackageImports`.
 *  - Long-lived immutable caching for hashed static assets, sensible security
 *    headers everywhere else.
 */
const nextConfig: NextConfig = {
  // Allow Playwright / curl against 127.0.0.1 while SITE_URL is localhost.
  allowedDevOrigins: ["127.0.0.1", "localhost"],

  // Self-contained server bundle for Docker (see Dockerfile).
  output: "standalone",

  // Gzip/br compression of HTML and assets at the Node layer.
  compress: true,

  // Don't advertise the framework.
  poweredByHeader: false,

  // Catch unsafe lifecycles / double-render bugs early in dev.
  reactStrictMode: true,

  // Keep prod bundles lean — no browser source maps shipped to clients.
  productionBrowserSourceMaps: false,

  experimental: {
    // Only pull the icons/helpers actually used instead of the whole barrel,
    // which meaningfully shrinks the client JS for these large packages.
    optimizePackageImports: [
      "lucide-react",
      "motion",
      "date-fns",
      "lodash-es",
      "@tanstack/charts",
    ],
  },

  images: {
    // Modern formats first; Next negotiates per-browser.
    formats: ["image/avif", "image/webp"],
    // Optimizer may fetch only these hosts. Empty = same-origin only.
    remotePatterns: imageRemotePatternsFromEnv(),
  },

  async headers() {
    const securityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=()",
      },
    ];

    // Note: Next.js already serves /_next/static with
    // `Cache-Control: public, max-age=31536000, immutable`, so we only add
    // security headers here and let the framework own asset caching.
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      // Service worker must revalidate quickly so updates reach clients.
      {
        source: "/sw.js",
        headers: [
          ...securityHeaders,
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
