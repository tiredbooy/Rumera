"use client"

import * as React from "react"
import Link from "next/link"
import { toast } from "sonner"
import { Heart, Plus, ShoppingCart, Check } from "lucide-react"

import {
  faNum,
  formatPrice,
  products,
  categoryFa,
  badgeFa,
  type Product,
} from "@/lib/products"
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
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{faNum(items.length)}</span> مورد ذخیره‌شده
        </p>
        <Button size="sm" variant="outline" onClick={moveAllToCart}>
          <ShoppingCart className="size-4" /> افزودن همه به سبد
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((p) => {
          const onSale = p.compareAt && p.compareAt > p.price
          const discount = onSale
            ? Math.round((1 - p.price / p.compareAt!) * 100)
            : 0
          return (
            <article
              key={p.id}
              className="group/product border-hairline relative flex h-full flex-col overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/5 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-foreground/5 hover:ring-primary/30 sm:rounded-3xl"
            >
              {/* Visual */}
              <div className="relative aspect-4/5 overflow-hidden">
                <Link href={`/products/${p.slug}`} className="absolute inset-0" aria-label={p.name}>
                  <div className="absolute inset-0 transition-transform duration-700 ease-out group-hover/product:scale-105">
                    <SmartImage
                      src={p.image}
                      alt={p.name}
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                      monogram={p.name.charAt(0)}
                      label={categoryFa[p.category]}
                      fallbackClassName="from-accent/40 via-card to-secondary"
                    />
                  </div>
                </Link>

                {/* Badges */}
                <div className="pointer-events-none absolute start-3 top-3 z-10 flex flex-col gap-1.5 sm:start-4 sm:top-4">
                  {p.badge ? (
                    <Badge className="bg-gold text-gold-foreground shadow-sm">{badgeFa[p.badge]}</Badge>
                  ) : null}
                  {onSale ? (
                    <Badge className="bg-wine text-wine-foreground shadow-sm">٪{faNum(discount)}-</Badge>
                  ) : null}
                </div>

                {/* Remove from wishlist — filled heart, always reachable */}
                <button
                  type="button"
                  onClick={() => remove(p.id)}
                  aria-label="حذف از علاقه‌مندی‌ها"
                  className="absolute end-3 top-3 z-10 flex size-9 cursor-pointer items-center justify-center rounded-full bg-background/80 text-wine shadow-sm backdrop-blur-md transition-all duration-300 hover:scale-110 hover:bg-wine hover:text-wine-foreground sm:end-4 sm:top-4"
                >
                  <Heart className="size-4 fill-current" />
                </button>

                {/* Move to cart — slides up on hover (hover-capable devices only) */}
                <div className="pointer-events-none absolute inset-x-3 bottom-3 z-10 hidden translate-y-3 opacity-0 transition-all duration-300 group-hover/product:translate-y-0 group-hover/product:opacity-100 [@media(hover:hover)]:block">
                  <Button
                    type="button"
                    className="pointer-events-auto h-11 w-full cursor-pointer rounded-2xl shadow-lg"
                    onClick={() => addToCart(p)}
                  >
                    <Plus /> افزودن به سبد
                  </Button>
                </div>
              </div>

              {/* Body */}
              <div className="flex flex-1 flex-col gap-2 p-4 sm:gap-2.5 sm:p-5">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[11px] font-medium text-primary sm:text-xs">
                    {categoryFa[p.category]}
                  </span>
                  <Badge variant="secondary" className="gap-1 px-2 py-0 text-[10px]">
                    <Check className="size-3" /> موجود
                  </Badge>
                </div>

                <div>
                  <h3 className="line-clamp-1 font-serif text-base leading-tight transition-colors group-hover/product:text-primary sm:text-xl">
                    <Link href={`/products/${p.slug}`}>{p.name}</Link>
                  </h3>
                  <p className="truncate text-[11px] text-muted-foreground sm:text-xs">{p.maker}</p>
                </div>

                <div className="mt-auto flex items-end justify-between gap-2 pt-1.5 sm:pt-2">
                  <span className="flex min-w-0 flex-col leading-tight">
                    <span className="flex flex-wrap items-baseline gap-x-1.5">
                      <span className="font-serif text-lg text-foreground sm:text-2xl">
                        {formatPrice(p.price)}
                      </span>
                      {onSale ? (
                        <span className="text-[10px] text-muted-foreground line-through sm:text-xs">
                          {formatPrice(p.compareAt!)}
                        </span>
                      ) : null}
                    </span>
                  </span>
                  <Button
                    size="icon"
                    variant="secondary"
                    className="size-10 shrink-0 cursor-pointer rounded-xl transition-colors group-hover/product:bg-primary group-hover/product:text-primary-foreground sm:size-11 sm:rounded-2xl [@media(hover:hover)]:hidden"
                    aria-label={`افزودن ${p.name} به سبد خرید`}
                    onClick={() => addToCart(p)}
                  >
                    <Plus />
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
