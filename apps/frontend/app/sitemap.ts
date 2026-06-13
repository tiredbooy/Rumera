import type { MetadataRoute } from "next"

import { absoluteUrl } from "@/lib/site"
import { categories, products } from "@/lib/products"

/**
 * Programmatic sitemap. Search engines read this at /sitemap.xml.
 * Includes the home page, every category landing and every product detail so
 * the full catalogue is crawlable. Extend as real routes are added.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), lastModified: now, changeFrequency: "daily", priority: 1 },
  ]

  const categoryRoutes: MetadataRoute.Sitemap = categories.map((c) => ({
    url: absoluteUrl(`/category/${c.name.toLowerCase()}`),
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.7,
  }))

  const productRoutes: MetadataRoute.Sitemap = products.map((p) => ({
    url: absoluteUrl(`/products/${p.slug}`),
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.6,
  }))

  return [...staticRoutes, ...categoryRoutes, ...productRoutes]
}
