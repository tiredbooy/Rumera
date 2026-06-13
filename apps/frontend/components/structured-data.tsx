import { siteConfig, absoluteUrl } from "@/lib/site"
import { products, type Product } from "@/lib/products"

/**
 * Server-rendered JSON-LD. Emitting Organization + WebSite + ItemList lets
 * search engines understand the brand, wire up the sitelinks search box, and
 * surface product results with rich snippets (price, rating, availability).
 *
 * Rendered as a plain <script> in a server component — zero client JS.
 */

function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      // Data is built from trusted local sources, not user input.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}

function productLd(p: Product) {
  return {
    "@type": "Product",
    name: p.name,
    description: p.note,
    brand: { "@type": "Brand", name: p.maker },
    category: p.category,
    url: absoluteUrl(`/products/${p.slug}`),
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: p.rating,
      reviewCount: p.reviews,
    },
    offers: {
      "@type": "Offer",
      price: p.price,
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
      url: absoluteUrl(`/products/${p.slug}`),
    },
  }
}

export function HomeStructuredData() {
  const organization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteConfig.name,
    url: siteConfig.url,
    description: siteConfig.description,
    logo: absoluteUrl("/icon"),
    sameAs: Object.values(siteConfig.socials),
  }

  const website = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteConfig.name,
    url: siteConfig.url,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: absoluteUrl("/search?q={search_term_string}"),
      },
      "query-input": "required name=search_term_string",
    },
  }

  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Featured bottles",
    itemListElement: products.map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: productLd(p),
    })),
  }

  return (
    <>
      <JsonLd data={organization} />
      <JsonLd data={website} />
      <JsonLd data={itemList} />
    </>
  )
}
