"use client"

import * as React from "react"
import Link from "next/link"
import { toast } from "sonner"
import { Heart, Plus, ShoppingCart, Trash2, Check } from "lucide-react"

import { faNum, formatPrice, products, categoryFa, type Product } from "@/lib/products"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { SmartImage } from "@/components/smart-image"
import { EmptyState } from "./empty-state"

// TODO(api): wire to GET/DELETE /api/v1/wishlist. Until the wishlist service is
// connected the page is bound to this clearly-marked sample so the full UI
// (remove, add-to-cart, move-all, empty state) is real and testable.
const SAMPLE: Product[] = products.slice(0, 6)

export function WishlistView() {
  const [items, setItems] = React.useState<Product[]>(SAMPLE)

  function remove(id: string) {
    setItems((list) => list.filter((p) => p.id !== id))
    toast.success("از علاقه‌مندی‌ها حذف شد")
  }

  function addToCart(p: Product) {
    // TODO(api): wire to POST /api/store/cart/items once variant ids are available.
    toast.success("به سبد خرید افزوده شد", {
      description: `${p.name} — ${formatPrice(p.price)}`,
    })
  }

  function moveAllToCart() {
    if (items.length === 0) return
    toast.success(`${faNum(items.length)} مورد به سبد خرید افزوده شد`)
    setItems([])
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={Heart}
        title="فهرست علاقه‌مندی‌ها خالی است"
        description="بطری‌هایی را که دوست دارید ذخیره کنید تا بعداً به‌راحتی پیدایشان کنید."
        actionLabel="کشف محصولات"
        actionHref="/products"
      />
    )
  }

  return (
    <>
      <div className="mb-5 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{faNum(items.length)} مورد</p>
        <Button size="sm" variant="outline" onClick={moveAllToCart}>
          <ShoppingCart className="size-4" /> افزودن همه به سبد
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((p) => {
          const onSale = p.compareAt && p.compareAt > p.price
          return (
            <article
              key={p.id}
              className="border-hairline group/wish flex gap-4 overflow-hidden rounded-2xl bg-card p-4 ring-1 ring-foreground/5 transition-colors hover:ring-foreground/10"
            >
              <Link
                href={`/products/${p.slug}`}
                className="relative aspect-4/5 w-24 shrink-0 overflow-hidden rounded-xl"
                aria-label={p.name}
              >
                <SmartImage
                  src={p.image}
                  alt={p.name}
                  sizes="96px"
                  monogram={p.name.charAt(0)}
                  label={categoryFa[p.category]}
                  fallbackClassName="from-accent/40 via-card to-secondary"
                />
              </Link>

              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs text-primary">{categoryFa[p.category]}</p>
                    <h3 className="line-clamp-1 font-serif text-base leading-tight">
                      <Link href={`/products/${p.slug}`} className="hover:text-primary">
                        {p.name}
                      </Link>
                    </h3>
                    <p className="truncate text-xs text-muted-foreground">{p.maker}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(p.id)}
                    aria-label="حذف از علاقه‌مندی‌ها"
                    className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>

                <div className="mt-1.5">
                  <Badge variant="secondary" className="gap-1">
                    <Check className="size-3" /> موجود
                  </Badge>
                </div>

                <div className="mt-auto flex items-end justify-between gap-2 pt-3">
                  <span className="flex flex-col">
                    <span className="font-serif text-lg">{formatPrice(p.price)}</span>
                    {onSale ? (
                      <span className="text-xs text-muted-foreground line-through">
                        {formatPrice(p.compareAt!)}
                      </span>
                    ) : null}
                  </span>
                  <Button size="sm" onClick={() => addToCart(p)}>
                    <Plus className="size-4" /> افزودن به سبد
                  </Button>
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </>
  )
}
