import type { CategoryTree } from "@/features/catalog/categories/types";
import { ProductsMegaMenu } from "@/features/catalog/categories/components/product-mega-menu";

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

export function SiteHeader({ categoryTree }: SiteHeaderProps) {
  return (
    <>
      <PromoBar />
      <HeaderChrome>
        <div className="container-px mx-auto flex h-16 max-w-7xl items-center gap-3 lg:gap-5">
          <div className="flex items-center md:hidden">
            <MobileNavDrawer categoryTree={categoryTree} />
          </div>

          <HeaderLogo />

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
