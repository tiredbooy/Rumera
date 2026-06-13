"use client"

import * as React from "react"
import Link from "next/link"
import { Menu, Search, Wine, Sparkles, User } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { ModeToggle } from "@/components/mode-toggle"
import { CartButton } from "@/components/cart/cart-button"
import { categories, categoryFa } from "@/lib/products"

const nav = [
  { label: "فروشگاه", href: "/products" },
  { label: "دستورها", href: "/recipes" },
  { label: "ژورنال", href: "/journal" },
  { label: "دربارهٔ ما", href: "/about" },
]

export function SiteHeader() {
  return (
    <>
      {/* Thin promo strip — sets the premium-delivery tone before the header. */}
      <div className="bg-foreground text-background">
        <div className="container-px mx-auto flex h-9 max-w-7xl items-center justify-center gap-2 text-xs font-medium">
          <Sparkles className="size-3.5 text-primary" />
          ارسال خنک و رایگان برای سفارش‌های بالای ۵٬۰۰۰٬۰۰۰ تومان
        </div>
      </div>

      <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="container-px mx-auto flex h-16 max-w-7xl items-center justify-between gap-4">
          {/* Mobile menu */}
          <div className="flex items-center gap-1 md:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="باز کردن منو">
                  <Menu />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-80">
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2 font-serif text-2xl">
                    <Wine className="size-5 text-primary" /> رومرا
                  </SheetTitle>
                </SheetHeader>
                <nav className="mt-2 flex flex-col px-4">
                  {nav.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="border-b border-border/50 py-3 text-sm font-medium"
                    >
                      {item.label}
                    </Link>
                  ))}
                  <p className="eyebrow mt-6 mb-2">دسته‌بندی‌ها</p>
                  {categories.map((c) => (
                    <Link
                      key={c.name}
                      href={`/categories/${c.name.toLowerCase()}`}
                      className="py-2 text-sm text-muted-foreground"
                    >
                      {categoryFa[c.name]}
                    </Link>
                  ))}
                </nav>
              </SheetContent>
            </Sheet>
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
            <Button variant="ghost" size="icon" aria-label="حساب کاربری" asChild>
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
