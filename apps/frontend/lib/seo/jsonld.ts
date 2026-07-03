/**
 * JSON-LD builders. Centralising structured data keeps rich-result markup
 * consistent and is the backbone of GEO (AI-search) visibility — assistants
 * read this graph to understand and cite the catalogue.
 *
 * Builders return plain objects; render them with <JsonLd /> (components/json-ld).
 */
import { siteConfig, absoluteUrl } from "@/lib/site"
import {  type Product } from "@/lib/products"
import type { ProductDetail, ProductListItem } from "@/lib/catalog/types"

export function organizationLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteConfig.name,
    url: siteConfig.url,
    description: siteConfig.description,
    logo: absoluteUrl("/icon"),
    sameAs: Object.values(siteConfig.socials),
  }
}

export function websiteLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteConfig.name,
    url: siteConfig.url,
    inLanguage: "fa-IR",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: absoluteUrl("/search?q={search_term_string}"),
      },
      "query-input": "required name=search_term_string",
    },
  }
}

export function productLd(p: Product) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    description: p.note,
    brand: { "@type": "Brand", name: p.maker },
    url: absoluteUrl(`/products/${p.slug}`),
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: p.rating,
      reviewCount: p.reviews,
    },
    offers: {
      "@type": "Offer",
      price: p.price,
      priceCurrency: "IRR",
      availability: "https://schema.org/InStock",
      url: absoluteUrl(`/products/${p.slug}`),
    },
  }
}

/** Product JSON-LD from a live API `ProductDetail`. Pass `rating` (from the
 * reviews summary) to emit AggregateRating, and `reviews` to emit individual
 * Review nodes — both power Google/AI review rich-results. */
export function productDetailLd(
  p: ProductDetail,
  rating?: { value: number; count: number },
  reviews?: {
    rating: number
    title?: string
    content?: string
    author?: string
    created_at: string
  }[]
) {
  const prices = (p.variants ?? []).map((v) => v.price).filter((n) => n > 0)
  const low = prices.length ? Math.min(...prices) : undefined
  const high = prices.length ? Math.max(...prices) : undefined
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.title,
    description: p.description ?? p.meta_description,
    sku: p.variants?.[0]?.sku,
    mpn: p.code,
    url: absoluteUrl(`/products/${p.slug}`),
    image: (p.images ?? []).map((img) => img.image_url),
    ...(p.country_of_origin ? { countryOfOrigin: p.country_of_origin } : {}),
    ...(rating && rating.count > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: Number(rating.value.toFixed(1)),
            reviewCount: rating.count,
          },
        }
      : {}),
    ...(reviews && reviews.length
      ? {
          review: reviews.slice(0, 8).map((r) => ({
            "@type": "Review",
            reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5 },
            ...(r.author ? { author: { "@type": "Person", name: r.author } } : {}),
            ...(r.title ? { name: r.title } : {}),
            ...(r.content ? { reviewBody: r.content } : {}),
            datePublished: r.created_at,
          })),
        }
      : {}),
    offers:
      low !== undefined
        ? {
            "@type": "AggregateOffer",
            priceCurrency: "IRR",
            lowPrice: low,
            highPrice: high,
            offerCount: prices.length,
            availability: "https://schema.org/InStock",
            url: absoluteUrl(`/products/${p.slug}`),
          }
        : undefined,
  }
}

/** ItemList JSON-LD from live `ProductListItem`s (listing pages). */
export function productListLd(name: string, items: ProductListItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    itemListElement: items.map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: p.title,
      url: absoluteUrl(`/products/${p.slug}`),
    })),
  }
}

export function breadcrumbLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  }
}

export function itemListLd(name: string, products: Product[]) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    itemListElement: products.map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: productLd(p),
    })),
  }
}

export function faqLd(items: { question: string; answer: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  }
}

export function recipeLd(recipe: {
  name: string
  description: string
  slug: string
  ingredients: string[]
  steps: string[]
  totalTime?: string
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Recipe",
    name: recipe.name,
    description: recipe.description,
    url: absoluteUrl(`/recipes/${recipe.slug}`),
    inLanguage: "fa-IR",
    recipeIngredient: recipe.ingredients,
    ...(recipe.totalTime ? { totalTime: recipe.totalTime } : {}),
    recipeInstructions: recipe.steps.map((text, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      text,
    })),
  }
}
