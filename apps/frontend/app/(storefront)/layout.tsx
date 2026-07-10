/**
 * Storefront shell — wraps every public page with the site header, footer and
 * age gate. Living in a route group means the dashboards (`/admin`, `/account`)
 * and auth pages render with their OWN chrome instead of inheriting this one.
 */
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { AgeGate } from "@/components/age-gate";
import { ReferralTracker } from "@/features/referral/components/referral-tracker";
import { listCategories } from "@/lib/catalog/categories";
import { fetchCategoryTree } from "@/features/catalog/categories/api";

export default async function StorefrontLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Feed the header's products mega-menu with live top-level categories. Falls
  // back to the curated sample set when the API is unreachable so the menu is
  // never empty (error-safe, mirrors the rest of the storefront).
  const live = await listCategories();
  const topLevel = live.filter((c) => c.parent_id == null);
  const categories = await fetchCategoryTree();

  return (
    <>
      <SiteHeader categoryTree={categories} />
      <main className="flex flex-1 flex-col">{children}</main>
      <SiteFooter />
      <AgeGate />
      <ReferralTracker />
    </>
  );
}
