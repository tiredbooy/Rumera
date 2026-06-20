"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
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
  X,
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
  // Scroll-aware chrome: the header tightens and deepens its elevation once the
  // page leaves the very top, giving an "app-like" floating bar.
  const [scrolled, setScrolled] = React.useState(false)
  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <>
      {/* Thin promo strip — sets the premium-delivery tone before the header. */}
      <div className="group/promo relative overflow-hidden bg-foreground text-background">
        <div className="container-px mx-auto flex h-9 max-w-7xl items-center justify-center gap-2 text-xs font-medium">
          <Sparkles className="size-3.5 text-primary" />
          <span className="truncate">
            ارسال رایگان برای سفارش‌های بالای ۵٬۰۰۰٬۰۰۰ تومان — با ضمانت اصالت
          </span>
        </div>
        <span
          aria-hidden
          className="sheen pointer-events-none absolute inset-0 -translate-x-full opacity-0 transition-all duration-1000 group-hover/promo:translate-x-full group-hover/promo:opacity-100"
        />
      </div>

      <header
        className={cn(
          "sticky top-0 z-50 w-full border-b backdrop-blur-xl transition-[background-color,border-color,box-shadow] duration-300",
          scrolled
            ? "border-border/60 bg-background/85 shadow-e1"
            : "border-transparent bg-background/60"
        )}
      >
        <div className="container-px mx-auto flex h-16 max-w-7xl items-center gap-3 lg:gap-5">
          {/* Mobile menu */}
          <div className="flex items-center md:hidden">
            <MobileMenu categories={categories} />
          </div>

          {/* Wordmark */}
          <Link
            href="/"
            aria-label="رومرا — خانه"
            className="group/brand flex shrink-0 items-center gap-2"
          >
            <span className="flex size-8 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/15 transition-all duration-300 group-hover/brand:bg-primary/25 group-hover/brand:ring-primary/30">
              <Wine className="size-4.5 transition-transform duration-500 group-hover/brand:-rotate-12" />
            </span>
            <span className="font-serif text-3xl leading-none">
              <span className="text-foil">رومرا</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-0.5 md:flex">
            <ProductsMenu categories={categories} />
            {nav.map((item) => (
              <Button key={item.href} variant="ghost" size="sm" asChild>
                <Link href={item.href}>{item.label}</Link>
              </Button>
            ))}
          </nav>

          {/* Inline search — grows to fill the gap on large screens */}
          <div className="hidden flex-1 justify-center px-2 lg:flex">
            <HeaderSearch />
          </div>

          {/* Spacer for md (no inline search there) */}
          <div className="flex-1 lg:hidden" />

          {/* Actions */}
          <div className="flex shrink-0 items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              aria-label="جستجو"
              asChild
              className="lg:hidden"
            >
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
            {/* Divider before the cart so it reads as the primary action */}
            <span className="mx-1 hidden h-6 w-px bg-border/70 sm:block" />
            <CartButton />
          </div>
        </div>
      </header>
    </>
  )
}

/**
 * HeaderSearch — inline search field that submits to /search?q=… A plain GET form
 * so it works without JS and stays SEO/shareable; the icon is the submit button.
 */
function HeaderSearch() {
  const router = useRouter()
  const [value, setValue] = React.useState("")

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const q = value.trim()
    router.push(q ? `/search?q=${encodeURIComponent(q)}` : "/search")
  }

  return (
    <form
      onSubmit={onSubmit}
      role="search"
      className="group/search relative w-full max-w-md"
    >
      <button
        type="submit"
        aria-label="جستجو"
        className="absolute top-1/2 start-2.5 -translate-y-1/2 cursor-pointer text-muted-foreground transition-colors hover:text-foreground"
      >
        <Search className="size-4" />
      </button>
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="جستجوی محصول، برند یا دسته…"
        aria-label="جستجوی فروشگاه"
        className="h-10 w-full rounded-full border border-border/70 bg-secondary/50 ps-9 pe-9 text-sm outline-none transition-all placeholder:text-muted-foreground/80 focus:border-primary/50 focus:bg-background focus:ring-2 focus:ring-primary/20"
      />
      {value ? (
        <button
          type="button"
          onClick={() => setValue("")}
          aria-label="پاک کردن"
          className="absolute top-1/2 end-2.5 -translate-y-1/2 cursor-pointer text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      ) : null}
    </form>
  )
}

/**
 * Products mega-menu — opens on hover/focus, closes on leave/blur/Escape. The
 * trigger and panel share one wrapper so moving between them keeps it open; a
 * transparent `pt-2` bridges the gap. Pure CSS-positioned + one boolean of state
 * → light and snappy. Category rows carry a monogram chip (works with any
 * dynamic category name) and an arrow that slides in on hover.
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
    closeTimer.current = window.setTimeout(() => setOpen(false), 100)
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
        className={cn("cursor-pointer gap-1", open && "bg-accent")}
      >
        محصولات
        <ChevronDown
          className={cn("size-4 transition-transform duration-200", open && "rotate-180")}
        />
      </Button>

      {open ? (
        <div className="absolute start-0 top-full z-50 pt-2">
          <div className="animate-in fade-in-0 zoom-in-95 slide-in-from-top-1 shadow-e3 w-[min(94vw,680px)] overflow-hidden rounded-3xl border border-border/60 bg-popover/95 backdrop-blur-xl duration-150">
            <div className="grid grid-cols-1 sm:grid-cols-[1.5fr_1fr]">
              {/* Categories */}
              <div className="p-4 sm:p-5">
                <div className="mb-3 flex items-center justify-between">
                  <Link
                    href="/categories"
                    onClick={() => setOpen(false)}
                    className="eyebrow rounded-md outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary/40"
                  >
                    <Grid2x2 className="size-3.5" /> دسته‌بندی‌ها
                  </Link>
                  <Link
                    href="/products"
                    onClick={() => setOpen(false)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
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
                      className="group/cat flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm transition-colors hover:bg-accent"
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-serif text-sm text-primary transition-colors group-hover/cat:bg-primary group-hover/cat:text-primary-foreground">
                        {c.name.charAt(0)}
                      </span>
                      <span className="flex-1 truncate">{c.name}</span>
                      <ArrowLeft className="size-3.5 -translate-x-1 text-primary opacity-0 transition-all group-hover/cat:translate-x-0 group-hover/cat:opacity-100" />
                    </Link>
                  ))}
                </div>
              </div>

              {/* Promo */}
              <Link
                href="/products?sort=discount"
                onClick={() => setOpen(false)}
                className="cellar-glow group/promo relative flex flex-col justify-end gap-1 border-t border-border/60 p-5 transition-colors hover:bg-accent/40 sm:border-s sm:border-t-0"
              >
                <span className="flex size-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
                  <Tag className="size-5" />
                </span>
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
      <SheetContent side="right" className="flex w-80 flex-col overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 font-serif text-2xl">
            <Wine className="size-5 text-primary" /> رومرا
          </SheetTitle>
        </SheetHeader>

        {/* Search inside the drawer */}
        <form action="/search" role="search" className="relative px-4">
          <Search className="pointer-events-none absolute top-1/2 start-7 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            name="q"
            placeholder="جستجو…"
            aria-label="جستجوی فروشگاه"
            className="h-11 w-full rounded-full border border-border/70 bg-secondary/50 ps-9 pe-4 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
          />
        </form>

        <nav className="mt-2 flex flex-col px-4 pb-8">
          <SheetClose asChild>
            <Link
              href="/products"
              className="flex items-center justify-between border-b border-border/50 py-3 text-sm font-medium"
            >
              همهٔ محصولات <ArrowLeft className="size-4 text-primary" />
            </Link>
          </SheetClose>
          <SheetClose asChild>
            <Link
              href="/categories"
              className="flex items-center gap-2 border-b border-border/50 py-3 text-sm font-medium"
            >
              <Grid2x2 className="size-4 text-muted-foreground" /> دسته‌بندی‌ها
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

          <SheetClose asChild>
            <Link
              href="/categories"
              className="eyebrow mt-6 mb-2 w-fit rounded-md outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <Grid2x2 className="size-3.5" /> دسته‌بندی‌ها
            </Link>
          </SheetClose>
          <div className="grid grid-cols-2 gap-1">
            {categories.map((c) => (
              <SheetClose asChild key={c.slug}>
                <Link
                  href={`/categories/${c.slug}`}
                  className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-serif text-xs text-primary">
                    {c.name.charAt(0)}
                  </span>
                  <span className="truncate">{c.name}</span>
                </Link>
              </SheetClose>
            ))}
          </div>
        </nav>
      </SheetContent>
    </Sheet>
  )
}
