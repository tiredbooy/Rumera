"use client"

import * as React from "react"
import Link from "next/link"
import {
  Menu,
  Search,
  Wine,
  Sparkles,
  User,
  ChevronDown,
  ArrowLeft,
  Grid2x2,
  Tag,
  BookOpen,
  UtensilsCrossed,
  Info,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { ModeToggle } from "@/components/mode-toggle"
import { CartButton } from "@/components/cart/cart-button"

export type HeaderCategory = { name: string; slug: string }

const nav = [
  { label: "دستورها", href: "/recipes", icon: UtensilsCrossed },
  { label: "ژورنال", href: "/journal", icon: BookOpen },
  { label: "دربارهٔ ما", href: "/about", icon: Info },
]

export function SiteHeader({ categories }: { categories: HeaderCategory[] }) {
  return (
    <>
      {/* Thin promo strip — sets the premium-delivery tone before the header. */}
      <div className="bg-foreground text-background">
        <div className="container-px mx-auto flex h-9 max-w-7xl items-center justify-center gap-2 text-xs font-medium">
          <Sparkles className="size-3.5 text-primary" />
          ارسال رایگان برای سفارش‌های بالای ۵٬۰۰۰٬۰۰۰ تومان — با ضمانت اصالت
        </div>
      </div>

      <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="container-px mx-auto flex h-16 max-w-7xl items-center justify-between gap-4">
          {/* Mobile menu */}
          <div className="flex items-center gap-1 md:hidden">
            <MobileMenu categories={categories} />
          </div>

          {/* Wordmark */}
          <Link href="/" className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Wine className="size-4.5" />
            </span>
            <span className="font-serif text-3xl leading-none">
              <span className="text-foil">رومرا</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-1 md:flex">
            <ProductsMenu categories={categories} />
            {nav.map((item) => (
              <Button key={item.href} variant="ghost" size="sm" asChild>
                <Link href={item.href}>{item.label}</Link>
              </Button>
            ))}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" aria-label="جستجو" asChild>
              <Link href="/search">
                <Search />
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="حساب کاربری"
              asChild
              className="hidden sm:inline-flex"
            >
              <Link href="/account">
                <User />
              </Link>
            </Button>
            <ModeToggle />
            <CartButton />
          </div>
        </div>
      </header>
    </>
  )
}

/**
 * Products mega-menu — opens on hover/focus, closes on leave/blur/Escape. The
 * trigger and panel share one wrapper so moving between them keeps it open; a
 * transparent `pt-2` bridges the gap. Pure CSS-positioned + one boolean of state
 * → light and snappy. The panel content is plain links (no images) so it stays
 * fast.
 */
function ProductsMenu({ categories }: { categories: HeaderCategory[] }) {
  const [open, setOpen] = React.useState(false)
  const closeTimer = React.useRef<number | undefined>(undefined)

  const openNow = () => {
    window.clearTimeout(closeTimer.current)
    setOpen(true)
  }
  // Small delay avoids flicker when crossing the trigger→panel gap.
  const closeSoon = () => {
    window.clearTimeout(closeTimer.current)
    closeTimer.current = window.setTimeout(() => setOpen(false), 120)
  }

  return (
    <div
      className="relative"
      onMouseEnter={openNow}
      onMouseLeave={closeSoon}
      onFocusCapture={openNow}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false)
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") setOpen(false)
      }}
    >
      <Button
        variant="ghost"
        size="sm"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((v) => !v)}
        className="gap-1"
      >
        محصولات
        <ChevronDown
          className={cn("size-4 transition-transform duration-200", open && "rotate-180")}
        />
      </Button>

      {open ? (
        <div className="absolute start-0 top-full z-50 pt-2">
          <div className="animate-in fade-in-0 slide-in-from-top-1 w-[min(92vw,640px)] overflow-hidden rounded-3xl border border-border/60 bg-popover shadow-2xl shadow-foreground/10 duration-200">
            <div className="grid grid-cols-1 sm:grid-cols-[1.4fr_1fr]">
              {/* Categories */}
              <div className="p-5">
                <div className="mb-3 flex items-center justify-between">
                  <p className="eyebrow">
                    <Grid2x2 className="size-3.5" /> دسته‌بندی‌ها
                  </p>
                  <Link
                    href="/products"
                    onClick={() => setOpen(false)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary"
                  >
                    همهٔ محصولات <ArrowLeft className="size-3.5" />
                  </Link>
                </div>
                <div className="grid grid-cols-2 gap-1">
                  {categories.map((c) => (
                    <Link
                      key={c.slug}
                      href={`/categories/${c.slug}`}
                      onClick={() => setOpen(false)}
                      className="group/cat flex items-center justify-between rounded-xl px-3 py-2 text-sm transition-colors hover:bg-accent"
                    >
                      {c.name}
                      <ArrowLeft className="size-3.5 -translate-x-1 text-primary opacity-0 transition-all group-hover/cat:translate-x-0 group-hover/cat:opacity-100" />
                    </Link>
                  ))}
                </div>
              </div>

              {/* Promo */}
              <Link
                href="/products?sort=discount"
                onClick={() => setOpen(false)}
                className="cellar-glow group/promo relative flex flex-col justify-end gap-1 border-t border-border/60 p-5 sm:border-s sm:border-t-0"
              >
                <Tag className="size-5 text-primary" />
                <p className="mt-2 font-serif text-xl leading-tight">پیشنهادهای ویژه</p>
                <p className="text-sm text-muted-foreground">
                  منتخب تخفیف‌های این هفته را ببینید.
                </p>
                <span className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary">
                  مشاهده
                  <ArrowLeft className="size-4 transition-transform group-hover/promo:-translate-x-1" />
                </span>
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function MobileMenu({ categories }: { categories: HeaderCategory[] }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="باز کردن منو">
          <Menu />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-80 overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 font-serif text-2xl">
            <Wine className="size-5 text-primary" /> رومرا
          </SheetTitle>
        </SheetHeader>
        <nav className="mt-2 flex flex-col px-4 pb-8">
          <SheetClose asChild>
            <Link
              href="/products"
              className="flex items-center justify-between border-b border-border/50 py-3 text-sm font-medium"
            >
              همهٔ محصولات <ArrowLeft className="size-4 text-primary" />
            </Link>
          </SheetClose>
          {nav.map((item) => (
            <SheetClose asChild key={item.href}>
              <Link
                href={item.href}
                className="flex items-center gap-2 border-b border-border/50 py-3 text-sm font-medium"
              >
                <item.icon className="size-4 text-muted-foreground" /> {item.label}
              </Link>
            </SheetClose>
          ))}
          <SheetClose asChild>
            <Link
              href="/account"
              className="flex items-center gap-2 border-b border-border/50 py-3 text-sm font-medium"
            >
              <User className="size-4 text-muted-foreground" /> حساب کاربری
            </Link>
          </SheetClose>

          <p className="eyebrow mt-6 mb-2">دسته‌بندی‌ها</p>
          <div className="grid grid-cols-2 gap-1">
            {categories.map((c) => (
              <SheetClose asChild key={c.slug}>
                <Link
                  href={`/categories/${c.slug}`}
                  className="rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  {c.name}
                </Link>
              </SheetClose>
            ))}
          </div>
        </nav>
      </SheetContent>
    </Sheet>
  )
}
