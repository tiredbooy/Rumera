/**
 * `buildMetadata` — one helper that produces consistent canonical URLs, Open
 * Graph and Twitter cards, and robots directives for every route. Dashboards and
 * auth pages pass `index: false` to stay out of the index.
 */
import type { Metadata } from "next"

import { absoluteUrl, siteConfig } from "@/lib/site"

type BuildMetadataInput = {
  title?: string
  description?: string
  /** Path for the canonical + OG URL, e.g. "/products/aobane-18-year". */
  path?: string
  /** Set false for private/utility routes (dashboards, auth). */
  index?: boolean
  images?: string[]
  type?: "website" | "article"
  /** Optional keyword hints (e.g. product tags) for the meta keywords tag. */
  keywords?: string[]
}

export function buildMetadata({
  title,
  description,
  path = "/",
  index = true,
  images,
  type = "website",
  keywords,
}: BuildMetadataInput = {}): Metadata {
  const url = absoluteUrl(path)
  const desc = description ?? siteConfig.description

  return {
    title,
    description: desc,
    ...(keywords && keywords.length ? { keywords } : {}),
    alternates: { canonical: url },
    robots: index
      ? undefined
      : { index: false, follow: false, googleBot: { index: false, follow: false } },
    openGraph: {
      title: title ?? siteConfig.title,
      description: desc,
      url,
      siteName: siteConfig.name,
      locale: siteConfig.locale,
      type,
      images: images ?? [siteConfig.ogImage],
    },
    twitter: {
      card: "summary_large_image",
      title: title ?? siteConfig.title,
      description: desc,
      images: images ?? [siteConfig.ogImage],
    },
  }
}

/** Convenience for private routes (account/admin/auth). */
export const noindexMetadata = (title: string): Metadata =>
  buildMetadata({ title, index: false })
