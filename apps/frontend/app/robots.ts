import type { MetadataRoute } from "next"

import { absoluteUrl } from "@/lib/site"

/**
 * robots.txt served at /robots.txt. Allows everything except internal API
 * routes, and points crawlers at the sitemap.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/"],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
    host: absoluteUrl("/"),
  }
}
