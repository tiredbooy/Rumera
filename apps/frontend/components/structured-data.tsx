import { JsonLd } from "@/components/json-ld";
import { organizationLd, websiteLd } from "@/lib/seo/jsonld";

/**
 * Home-page JSON-LD: Organization + WebSite (SearchAction). Live `siteConfig`
 * only — no mock product ItemList. Builders live in `lib/seo/jsonld.ts`.
 */
export function HomeStructuredData() {
  return <JsonLd data={[organizationLd(), websiteLd()]} />;
}
