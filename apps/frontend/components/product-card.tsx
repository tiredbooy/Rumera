"use client"

import { Star, Plus } from "lucide-react"
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
import { Bottle } from "@/components/bottle"

export function ProductCard({ product }: { product: Product }) {
  const onSale = product.compareAt && product.compareAt > product.price

  return (
    <article className="group/product border-hairline relative flex flex-col overflow-hidden rounded-3xl bg-card ring-1 ring-foreground/5 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:ring-primary/30">
      {/* Visual */}
      <div className="relative flex h-56 items-end justify-center overflow-hidden">
        <div
          className="absolute inset-0 opacity-90 transition-opacity duration-300 group-hover/product:opacity-100"
          style={{
            background: `radial-gradient(75% 60% at 50% 120%, ${product.hue[0]}, transparent 70%)`,
          }}
        />
        <div className="absolute start-4 top-4 flex flex-col gap-1.5">
          {product.badge ? (
            <Badge className="bg-gold text-gold-foreground shadow-sm">
              {badgeFa[product.badge]}
            </Badge>
          ) : null}
          {onSale ? (
            <Badge className="bg-wine text-wine-foreground shadow-sm">حراج</Badge>
          ) : null}
        </div>
        <Bottle product={product} className="relative h-48 transition-transform duration-500 group-hover/product:-translate-y-1 group-hover/product:scale-105" />
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-3 border-t border-border/60 p-5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            {categoryFa[product.category]}
          </span>
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Star className="size-3 fill-primary text-primary" />
            {faNum(product.rating)}
            <span className="text-muted-foreground/60">({faNum(product.reviews)})</span>
          </span>
        </div>

        <div>
          <h3 className="font-serif text-xl leading-tight">{product.name}</h3>
          <p className="text-xs text-muted-foreground">
            {product.maker} · {product.origin}
          </p>
        </div>

        <p className="line-clamp-2 text-sm text-muted-foreground">{product.note}</p>

        <div className="mt-auto flex items-end justify-between gap-3 pt-2">
          <div className="flex flex-col">
            <span className="text-[11px] text-muted-foreground">
              {faNum(product.volumeMl)} میلی‌لیتر · {faNum(product.abv)}٪ الکل
            </span>
            <span className="flex items-baseline gap-2">
              <span className="font-serif text-2xl text-foreground">
                {formatPrice(product.price)}
              </span>
              {onSale ? (
                <span className="text-xs text-muted-foreground line-through">
                  {formatPrice(product.compareAt!)}
                </span>
              ) : null}
            </span>
          </div>
          <Button
            size="icon-lg"
            className={cn("rounded-2xl")}
            aria-label={`افزودن ${product.name} به سبد خرید`}
            onClick={() =>
              toast.success("به سبد خرید افزوده شد", {
                description: `${product.name} — ${formatPrice(product.price)}`,
              })
            }
          >
            <Plus />
          </Button>
        </div>
      </div>
    </article>
  )
}
