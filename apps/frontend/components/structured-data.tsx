import { products } from "@/lib/products"
import { JsonLd } from "@/components/json-ld"
import { organizationLd, websiteLd, itemListLd } from "@/lib/seo/jsonld"

/**
 * Home-page JSON-LD: Organization + WebSite + ItemList. Lets search engines and
 * AI assistants understand the brand, wire up the sitelinks search box, and
 * surface products with rich snippets. Builders live in `lib/seo/jsonld.ts`.
 */
export function HomeStructuredData() {
  return (
    <JsonLd
      data={[organizationLd(), websiteLd(), itemListLd("بطری‌های منتخب", products)]}
    />
  )
}
