import type { MetadataRoute } from "next"

import { absoluteUrl } from "@/lib/site"

/**
 * robots.txt served at /robots.txt. Opens the storefront to crawlers (including
 * AI assistants), keeps private/auth/transient surfaces out of the index, and
 * points at both the sitemap and the GEO-oriented /llms.txt guide.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/admin",
        "/account",
        "/login",
        "/register",
        "/reset-password",
        "/forgot-password",
        "/cart",
        "/checkout",
        "/search",
        "/forbidden",
      ],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
    host: absoluteUrl("/"),
  }
}
