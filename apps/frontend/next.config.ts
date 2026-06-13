import type { NextConfig } from "next";

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
      "recharts",
    ],
  },

  images: {
    // Modern formats first; Next negotiates per-browser.
    formats: ["image/avif", "image/webp"],
    // Allow remote product imagery served from the API / object storage.
    // Tighten these hosts when the real CDN/storage origin is known.
    remotePatterns: [{ protocol: "https", hostname: "**" }],
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
    ];
  },
};

export default nextConfig;
