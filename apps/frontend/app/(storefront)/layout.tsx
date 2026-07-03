/**
 * Storefront shell — wraps every public page with the site header, footer and
 * age gate. Living in a route group means the dashboards (`/admin`, `/account`)
 * and auth pages render with their OWN chrome instead of inheriting this one.
 */
import { SiteHeader, type HeaderCategory } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { AgeGate } from "@/components/age-gate"
import { ReferralTracker } from "@/components/referral/referral-tracker"
import { listCategories } from "@/lib/catalog/categories"
import { getCategoryTree } from "@/components/categories"
import { getHomeCategories } from "@/lib/home/categories"

export default async function StorefrontLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Feed the header's products mega-menu with live top-level categories. Falls
  // back to the curated sample set when the API is unreachable so the menu is
  // never empty (error-safe, mirrors the rest of the storefront).
  const live = await listCategories()
  const topLevel = live.filter((c) => c.parent_id == null)
  const categories = await getHomeCategories()

  return (
    <>
      <SiteHeader categories={categories} />
      <main className="flex flex-1 flex-col">{children}</main>
      <SiteFooter />
      <AgeGate />
      <ReferralTracker />
    </>
  )
}
