/**
 * Storefront shell — wraps every public page with the site header, footer and
 * age gate. Living in a route group means the dashboards (`/admin`, `/account`)
 * and auth pages render with their OWN chrome instead of inheriting this one.
 */
import { SiteHeader } from "@/features/storefront/navigation/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { AgeGate } from "@/features/compliance/components/age-gate";
import { ReferralTracker } from "@/features/referral/components/referral-tracker";
import { PendingCartIntent } from "@/features/cart/pending-intent";
import { PendingAlertIntent } from "@/features/product-alerts/pending-alert";
import { PendingBulkAddIntent } from "@/features/recipes/pending-bulk-add";
import { PendingWishlistIntent } from "@/features/wishlist/pending-wishlist";
import { getCategoryTree } from "@/features/catalog/categories/api";
import { getPublicSiteSettingsOrNull } from "@/features/settings/api/server";
import { MaintenanceScreen } from "@/features/storefront/maintenance/components/maintenance-screen";
import { presentMaintenanceCopy } from "@/features/storefront/maintenance/present-maintenance";

export default async function StorefrontLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Settings 5xx fails open so an outage cannot 500 or close the shop.
  const maintenanceCopy = presentMaintenanceCopy(
    (await getPublicSiteSettingsOrNull())?.maintenance,
  );
  if (maintenanceCopy) {
    return <MaintenanceScreen message={maintenanceCopy} />;
  }

  // Layout errors 500 every public page; header already renders an empty tree.
  const categories = await getCategoryTree().catch(() => []);

  return (
    <>
      <SiteHeader categoryTree={categories} />
      <main id="main-content" tabIndex={-1} className="flex flex-1 flex-col">
        {children}
      </main>
      <SiteFooter />
      <AgeGate />
      <ReferralTracker />
      {/* Replays guest actions dropped by the login bounce (U-8 / U-13 / U-14). */}
      <PendingCartIntent />
      <PendingBulkAddIntent />
      <PendingWishlistIntent />
      <PendingAlertIntent />
    </>
  );
}
