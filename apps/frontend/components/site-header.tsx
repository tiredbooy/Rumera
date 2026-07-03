"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { PromoBar } from "./PromoBar"
import { HeaderLogo } from "./HeaderLogo"
import { NavLinks } from "./NavLinks"
import { ProductsMegaMenu } from "./ProductMegaMenu"
import { HeaderSearch } from "./HeaderSearch"
import { HeaderActions } from "./HeaderActions"
import { MobileNavDrawer } from "./MobileNavDrawer"
import type { CategoryTreeNode } from "./category"

interface SiteHeaderProps {
  /** Fetch this server-side (e.g. in app/layout.tsx via getCategoryTree()) and pass it down. */
  categoryTree: CategoryTreeNode[]
}

export function SiteHeader({ categoryTree }: SiteHeaderProps) {
  // Scroll-aware chrome: the header tightens and deepens its elevation once
  // the page leaves the very top, giving an "app-like" floating bar.
  const [scrolled, setScrolled] = React.useState(false)
  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <>
      <PromoBar />

      <header
        className={cn(
          "sticky top-0 z-50 w-full border-b backdrop-blur-xl transition-[background-color,border-color,box-shadow] duration-300",
          scrolled
            ? "border-border/60 bg-background/85 shadow-e1"
            : "border-transparent bg-background/60"
        )}
      >
        <div className="container-px mx-auto flex h-16 max-w-7xl items-center gap-3 lg:gap-5">
          <div className="flex items-center md:hidden">
            <MobileNavDrawer categoryTree={categoryTree} />
          </div>

          <HeaderLogo />

          <nav className="hidden items-center gap-0.5 md:flex">
            <ProductsMegaMenu categoryTree={categoryTree} />
            <NavLinks />
          </nav>

          <div className="hidden flex-1 justify-center px-2 lg:flex">
            <HeaderSearch />
          </div>
          {/* Spacer for md (no inline search there) */}
          <div className="flex-1 lg:hidden" />

          <HeaderActions />
        </div>
      </header>
    </>
  )
}