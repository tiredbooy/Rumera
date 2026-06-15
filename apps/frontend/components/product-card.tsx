"use client"

import * as React from "react"
import Link from "next/link"
import { Star, Plus, Heart, Check } from "lucide-react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import {
  badgeFa,
  categoryFa,
  faNum,
  formatPrice,
  type Product,
} from "@/lib/products"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { SmartImage } from "@/components/smart-image"

/**
 * ProductCard — the storefront's primary product tile.
 *
 * Leads with real product photography (SmartImage → branded placeholder when an
 * image is missing) and layers a luxe-but-friendly hover: the image lifts and
 * zooms, a wishlist control fades in, and (on hover-capable devices) a full-width
 * "add to cart" bar slides up. The footer is laid out to stay legible down to a
 * 2-column phone grid (~150px wide) — nothing wraps or overflows. Card image area
 * is 4:5 portrait — feed it 1000×1250 assets.
 */
export function ProductCard({ product }: { product: Product }) {
  const onSale = product.compareAt && product.compareAt > product.price
  const href = `/products/${product.slug}`
  const [wished, setWished] = React.useState(false)
  const [added, setAdded] = React.useState(false)

  const discount = onSale
    ? Math.round((1 - product.price / product.compareAt!) * 100)
    : 0

  function addToCart() {
    setAdded(true)
    toast.success("به سبد خرید افزوده شد", {
      description: `${product.name} — ${formatPrice(product.price)}`,
    })
    window.setTimeout(() => setAdded(false), 1600)
  }

  return (
    <article className="group/product border-hairline relative flex h-full flex-col overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/5 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-foreground/5 hover:ring-primary/30 sm:rounded-3xl">
      {/* Visual */}
      <div className="relative aspect-4/5 overflow-hidden">
        <Link href={href} className="absolute inset-0" aria-label={product.name}>
          <div className="absolute inset-0 transition-transform duration-700 ease-out group-hover/product:scale-105">
            <SmartImage
              src={product.image}
              alt={product.name}
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              monogram={product.name.charAt(0)}
              label={categoryFa[product.category]}
              fallbackClassName="from-accent/40 via-card to-secondary"
            />
          </div>
        </Link>

        {/* Badges */}
        <div className="pointer-events-none absolute start-3 top-3 z-10 flex flex-col gap-1.5 sm:start-4 sm:top-4">
          {product.badge ? (
            <Badge className="bg-gold text-gold-foreground shadow-sm">
              {badgeFa[product.badge]}
            </Badge>
          ) : null}
          {onSale ? (
            <Badge className="bg-wine text-wine-foreground shadow-sm">
              ٪{faNum(discount)}-
            </Badge>
          ) : null}
        </div>

        {/* Wishlist — fades in on hover, always reachable on touch */}
        <button
          type="button"
          onClick={() => setWished((w) => !w)}
          aria-label={wished ? "حذف از علاقه‌مندی‌ها" : "افزودن به علاقه‌مندی‌ها"}
          aria-pressed={wished}
          className={cn(
            "absolute end-3 top-3 z-10 flex size-9 cursor-pointer items-center justify-center rounded-full bg-background/80 text-foreground shadow-sm backdrop-blur-md transition-all duration-300 sm:end-4 sm:top-4",
            "hover:scale-110 hover:text-wine",
            "opacity-100 sm:opacity-0 sm:group-hover/product:opacity-100 sm:group-focus-within/product:opacity-100"
          )}
        >
          <Heart className={cn("size-4", wished && "fill-wine text-wine")} />
        </button>

        {/* Quick add bar — slides up on hover (hover-capable devices only) */}
        <div className="pointer-events-none absolute inset-x-3 bottom-3 z-10 hidden translate-y-3 opacity-0 transition-all duration-300 group-hover/product:translate-y-0 group-hover/product:opacity-100 [@media(hover:hover)]:block">
          <Button
            type="button"
            className="pointer-events-auto h-11 w-full cursor-pointer rounded-2xl shadow-lg"
            onClick={addToCart}
          >
            {added ? (
              <>
                <Check /> افزوده شد
              </>
            ) : (
              <>
                <Plus /> افزودن به سبد
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-2 p-4 sm:gap-2.5 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[11px] font-medium text-primary sm:text-xs">
            {categoryFa[product.category]}
          </span>
          <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground sm:text-xs">
            <Star className="size-3 fill-primary text-primary" />
            {faNum(product.rating)}
            <span className="hidden text-muted-foreground/60 sm:inline">
              ({faNum(product.reviews)})
            </span>
          </span>
        </div>

        <div>
          <h3 className="line-clamp-1 font-serif text-base leading-tight transition-colors group-hover/product:text-primary sm:text-xl">
            <Link href={href}>{product.name}</Link>
          </h3>
          <p className="truncate text-[11px] text-muted-foreground sm:text-xs">
            {product.maker} · {product.origin}
          </p>
        </div>

        <p className="line-clamp-2 hidden text-sm text-muted-foreground sm:block">
          {product.note}
        </p>

        <div className="mt-auto flex items-end justify-between gap-2 pt-1.5 sm:pt-2">
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-[10px] text-muted-foreground sm:text-[11px]">
              {faNum(product.volumeMl)} میلی‌لیتر · {faNum(product.abv)}٪
            </span>
            <span className="flex flex-wrap items-baseline gap-x-1.5">
              <span className="font-serif text-lg text-foreground sm:text-2xl">
                {formatPrice(product.price)}
              </span>
              {onSale ? (
                <span className="text-[10px] text-muted-foreground line-through sm:text-xs">
                  {formatPrice(product.compareAt!)}
                </span>
              ) : null}
            </span>
          </div>
          <Button
            size="icon"
            variant="secondary"
            className="size-10 shrink-0 cursor-pointer rounded-xl transition-colors group-hover/product:bg-primary group-hover/product:text-primary-foreground sm:size-11 sm:rounded-2xl"
            aria-label={`افزودن ${product.name} به سبد خرید`}
            onClick={addToCart}
          >
            {added ? <Check /> : <Plus />}
          </Button>
        </div>
      </div>
    </article>
  )
}
