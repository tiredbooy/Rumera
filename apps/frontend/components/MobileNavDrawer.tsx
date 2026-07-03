"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowLeft, ArrowRight, Grid2x2, Menu, User, Wine } from "lucide-react"

import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { HeaderSearch } from "./HeaderSearch"
import { staticNavItems } from "./NavLinks"
import type { CategoryTreeNode } from "./category"

interface MobileNavDrawerProps {
  categoryTree: CategoryTreeNode[]
}

export function MobileNavDrawer({ categoryTree }: MobileNavDrawerProps) {
  // `stack` holds the path of categories drilled into so far. Showing one
  // level at a time with a back action reads much better on touch than
  // stacking three levels of nested accordions.
  const [stack, setStack] = React.useState<CategoryTreeNode[]>([])
  const [sheetOpen, setSheetOpen] = React.useState(false)

  const currentLevel = stack.length ? stack[stack.length - 1].children ?? [] : categoryTree
  const currentTitle = stack.length ? stack[stack.length - 1].name : "دسته‌بندی‌ها"

  function reset() {
    setStack([])
  }

  return (
    <Sheet
      open={sheetOpen}
      onOpenChange={(next) => {
        setSheetOpen(next)
        if (!next) reset()
      }}
    >
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="باز کردن منو">
          <Menu />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex w-80 flex-col overflow-y-auto p-0">
        <SheetHeader className="p-4 pb-2">
          <SheetTitle className="flex items-center gap-2 font-serif text-2xl">
            <Wine className="size-5 text-primary" /> رومرا
          </SheetTitle>
        </SheetHeader>

        <div className="px-4">
          <HeaderSearch variant="drawer" onSubmitNavigate={() => setSheetOpen(false)} />
        </div>

        {stack.length === 0 ? (
          <nav className="mt-2 flex flex-col px-4 pb-2">
            <SheetClose asChild>
              <Link
                href="/products"
                className="flex items-center justify-between border-b border-border/50 py-3 text-sm font-medium"
              >
                همهٔ محصولات <ArrowLeft className="size-4 text-primary" />
              </Link>
            </SheetClose>
            {staticNavItems.map((item) => (
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
          </nav>
        ) : null}

        {/* Category drill-down */}
        <div className="flex flex-1 flex-col px-4 pb-6">
          <div className="mb-1 mt-3 flex items-center gap-2">
            {stack.length ? (
              <button
                type="button"
                onClick={() => setStack((s) => s.slice(0, -1))}
                aria-label="بازگشت"
                className="flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <ArrowRight className="size-4" />
              </button>
            ) : (
              <Grid2x2 className="size-3.5 text-primary" />
            )}
            <span className="eyebrow">{currentTitle}</span>
          </div>

          {stack.length > 0 ? (
            <SheetClose asChild>
              <Link
                href={`/categories/${stack[stack.length - 1].slug}`}
                className="mb-1 flex items-center justify-between rounded-xl px-2.5 py-2 text-sm font-medium text-primary hover:bg-accent"
              >
                مشاهدهٔ همهٔ «{stack[stack.length - 1].name}»
                <ArrowLeft className="size-3.5" />
              </Link>
            </SheetClose>
          ) : null}

          <div className="grid grid-cols-2 gap-1">
            {currentLevel?.map((cat) =>
              cat.children?.length ? (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setStack((s) => [...s, cat])}
                  className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-start text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <CategoryChip category={cat} />
                  <span className="flex-1 truncate">{cat.name}</span>
                  <ArrowLeft className="size-3.5 shrink-0 text-primary" />
                </button>
              ) : (
                <SheetClose asChild key={cat.id}>
                  <Link
                    href={`/categories/${cat.slug}`}
                    className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    <CategoryChip category={cat} />
                    <span className="truncate">{cat.name}</span>
                  </Link>
                </SheetClose>
              )
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function CategoryChip({ category }: { category: CategoryTreeNode }) {
  if (category.image_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={category.image_url}
        alt=""
        className="size-7 shrink-0 rounded-lg object-cover"
      />
    )
  }
  return (
    <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-serif text-xs text-primary">
      {category.name.charAt(0)}
    </span>
  )
}