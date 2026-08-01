import type { MetadataRoute } from "next";

import { absoluteUrl } from "@/lib/site";
import { allProductSlugs } from "@/features/catalog/products/api/public";
import { listCategories } from "@/features/catalog/categories/api";
import { getCategoryHref } from "@/features/catalog/categories/utils";
import { listRecipeSitemapItems } from "@/features/recipes/api/server";
import { listAllJournalPosts } from "@/features/journal/api/server";
import { listAllTags } from "@/features/catalog/tags/api/public";

/**
 * Programmatic sitemap served at /sitemap.xml. Covers every public, indexable
 * route — static pages, the live catalogue, category landings, recipes and the
 * journal — so search engines and AI crawlers can discover all of it. These are
 * primary reads, so failures propagate rather than publishing an incomplete
 * sitemap.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const [productSlugs, categories, tags, recipeItems, journalPosts] =
    await Promise.all([
      allProductSlugs(),
      listCategories(),
      listAllTags(),
      listRecipeSitemapItems(),
      listAllJournalPosts(),
    ]);

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: absoluteUrl("/"),
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: absoluteUrl("/products"),
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: absoluteUrl("/categories"),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: absoluteUrl("/tags"),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: absoluteUrl("/recipes"),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: absoluteUrl("/journal"),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: absoluteUrl("/faq"),
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: absoluteUrl("/about"),
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.4,
    },
  ];

  const categoryRoutes: MetadataRoute.Sitemap = categories.flatMap(
    (category) => {
      const href = getCategoryHref(category);
      return href
        ? [
            {
              url: absoluteUrl(href),
              lastModified: now,
              changeFrequency: "weekly" as const,
              priority: 0.7,
            },
          ]
        : [];
    },
  );

  const productRoutes: MetadataRoute.Sitemap = productSlugs.map((slug) => ({
    url: absoluteUrl(`/products/${encodeURIComponent(slug)}`),
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  const tagRoutes: MetadataRoute.Sitemap = tags.map((tag) => ({
    url: absoluteUrl(`/tags/${tag.id}`),
    lastModified: new Date(tag.updated_at),
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  const recipeRoutes: MetadataRoute.Sitemap = recipeItems.map((recipe) => ({
    url: absoluteUrl(`/recipes/${encodeURIComponent(recipe.slug)}`),
    lastModified: new Date(recipe.updated_at),
    changeFrequency: "monthly",
    priority: 0.5,
  }));

  const journalRoutes: MetadataRoute.Sitemap = journalPosts.map((p) => ({
    url: absoluteUrl(`/journal/${encodeURIComponent(p.slug)}`),
    lastModified: new Date(p.updated_at),
    changeFrequency: "monthly",
    priority: 0.5,
  }));

  return [
    ...staticRoutes,
    ...categoryRoutes,
    ...tagRoutes,
    ...productRoutes,
    ...recipeRoutes,
    ...journalRoutes,
  ];
}
