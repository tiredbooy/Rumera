"use client"

import * as React from "react"
import Link from "next/link"
import { Menu, Search, ShoppingBag, Wine } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { ModeToggle } from "@/components/mode-toggle"
import { categories } from "@/lib/products"

const nav = [
  { label: "Shop", href: "#catalog" },
  { label: "Collections", href: "#categories" },
  { label: "Cellar", href: "#story" },
  { label: "Journal", href: "#journal" },
]

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="container-px mx-auto flex h-16 max-w-7xl items-center justify-between gap-4">
        {/* Mobile menu */}
        <div className="flex items-center gap-1 md:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open menu">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2 font-serif text-xl">
                  <Wine className="size-5 text-primary" /> Rumera
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
                <p className="eyebrow mt-6 mb-2">Browse</p>
                {categories.map((c) => (
                  <Link
                    key={c.name}
                    href="#catalog"
                    className="py-2 text-sm text-muted-foreground"
                  >
                    {c.name}
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
          <span className="font-serif text-2xl tracking-tight">
            <span className="text-foil">Rumera</span>
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
          <Button variant="ghost" size="icon" aria-label="Search">
            <Search />
          </Button>
          <ModeToggle />
          <Button variant="ghost" size="icon" aria-label="Cart" className="relative">
            <ShoppingBag />
            <Badge className="absolute -right-0.5 -top-0.5 size-4 rounded-full p-0 text-[10px] tabular-nums">
              2
            </Badge>
          </Button>
        </div>
      </div>
    </header>
  )
}
