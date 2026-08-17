import { ProductsMegaMenu } from "@/features/catalog/categories/components/product-mega-menu";
import type { CategoryTree } from "@/features/catalog/categories/types";
import { getPublicSiteSettingsOrNull } from "@/features/settings/api/server";

import { toStorefrontChromeSettings } from "../chrome-settings";
import { productMenuPromotion } from "../config";
import { HeaderActions } from "./header-actions";
import { HeaderChrome } from "./header-chrome";
import { HeaderLogo } from "./header-logo";
import { HeaderSearch } from "./header-search";
import { MobileNavDrawer } from "./mobile-nav-drawer";
import { NavLinks } from "./nav-links";
import { PromoBar } from "./promo-bar";

interface SiteHeaderProps {
  categoryTree: CategoryTree[];
}

export async function SiteHeader({ categoryTree }: SiteHeaderProps) {
  const chrome = toStorefrontChromeSettings(
    await getPublicSiteSettingsOrNull(),
  );

  return (
    <>
      <PromoBar announcement={chrome.announcement} />
      <HeaderChrome>
        <div className="container-px mx-auto flex h-16 max-w-7xl items-center gap-3 lg:gap-5">
          <div className="flex items-center md:hidden">
            <MobileNavDrawer
              categoryTree={categoryTree}
              storeName={chrome.storeName}
            />
          </div>

          <HeaderLogo storeName={chrome.storeName} tagline={chrome.tagline} />

          <nav
            aria-label="ناوبری اصلی فروشگاه"
            className="hidden items-center gap-0.5 md:flex"
          >
            <ProductsMegaMenu
              categoryTree={categoryTree}
              promotion={productMenuPromotion}
            />
            <NavLinks />
          </nav>

          <div className="hidden flex-1 justify-center px-2 lg:flex">
            <HeaderSearch />
          </div>
          <div aria-hidden className="flex-1 lg:hidden" />

          <HeaderActions />
        </div>
      </HeaderChrome>
    </>
  );
}
