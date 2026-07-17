/**
 * Storefront shell — wraps every public page with the site header, footer and
 * age gate. Living in a route group means the dashboards (`/admin`, `/account`)
 * and auth pages render with their OWN chrome instead of inheriting this one.
 */
import { SiteHeader } from "@/features/storefront/navigation/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { AgeGate } from "@/features/compliance/components/age-gate";
import { ReferralTracker } from "@/features/referral/components/referral-tracker";
import { getCategoryTree } from "@/features/catalog/categories/api";

export default async function StorefrontLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const categories = await getCategoryTree();

  return (
    <>
      <SiteHeader categoryTree={categories} />
      <main id="main-content" tabIndex={-1} className="flex flex-1 flex-col">
        {children}
      </main>
      <SiteFooter />
      <AgeGate />
      <ReferralTracker />
    </>
  );
}
