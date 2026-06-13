import type { MetadataRoute } from "next"

import { absoluteUrl } from "@/lib/site"
import { listProducts } from "@/lib/catalog/products"
import { listCategories } from "@/lib/catalog/categories"
import { recipes } from "@/lib/recipes"
import { journalPosts } from "@/lib/journal"

/**
 * Programmatic sitemap served at /sitemap.xml. Covers every public, indexable
 * route — static pages, the live catalogue, category landings, recipes and the
 * journal — so search engines and AI crawlers can discover all of it. Catalogue
 * fetchers are error-safe, so this still renders (sans products) if the API is
 * down.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  const [catalogue, categories] = await Promise.all([
    listProducts({ limit: 100 }),
    listCategories(),
  ])

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: absoluteUrl("/products"), lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: absoluteUrl("/recipes"), lastModified: now, changeFrequency: "weekly", priority: 0.6 },
    { url: absoluteUrl("/journal"), lastModified: now, changeFrequency: "weekly", priority: 0.6 },
    { url: absoluteUrl("/faq"), lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: absoluteUrl("/about"), lastModified: now, changeFrequency: "monthly", priority: 0.4 },
  ]

  const categoryRoutes: MetadataRoute.Sitemap = categories.map((c) => ({
    url: absoluteUrl(`/categories/${c.slug}`),
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.7,
  }))

  const productRoutes: MetadataRoute.Sitemap = catalogue.results.map((p) => ({
    url: absoluteUrl(`/products/${p.slug}`),
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.6,
  }))

  const recipeRoutes: MetadataRoute.Sitemap = recipes.map((r) => ({
    url: absoluteUrl(`/recipes/${r.slug}`),
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.5,
  }))

  const journalRoutes: MetadataRoute.Sitemap = journalPosts.map((p) => ({
    url: absoluteUrl(`/journal/${p.slug}`),
    lastModified: new Date(p.date),
    changeFrequency: "monthly",
    priority: 0.5,
  }))

  return [
    ...staticRoutes,
    ...categoryRoutes,
    ...productRoutes,
    ...recipeRoutes,
    ...journalRoutes,
  ]
}
