"use client"

import { Star, Plus } from "lucide-react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { formatPrice, type Product } from "@/lib/products"
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
        <div className="absolute left-4 top-4 flex flex-col gap-1.5">
          {product.badge ? (
            <Badge className="bg-gold text-gold-foreground shadow-sm">
              {product.badge}
            </Badge>
          ) : null}
          {onSale ? (
            <Badge className="bg-wine text-wine-foreground shadow-sm">Sale</Badge>
          ) : null}
        </div>
        <Bottle product={product} className="relative h-48 transition-transform duration-500 group-hover/product:-translate-y-1 group-hover/product:scale-105" />
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-3 border-t border-border/60 p-5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {product.category}
          </span>
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Star className="size-3 fill-primary text-primary" />
            {product.rating.toFixed(1)}
            <span className="text-muted-foreground/60">({product.reviews})</span>
          </span>
        </div>

        <div>
          <h3 className="font-serif text-lg leading-tight">{product.name}</h3>
          <p className="text-xs text-muted-foreground">
            {product.maker} · {product.origin}
          </p>
        </div>

        <p className="line-clamp-2 text-sm text-muted-foreground">{product.note}</p>

        <div className="mt-auto flex items-end justify-between gap-3 pt-2">
          <div className="flex flex-col">
            <span className="text-[11px] text-muted-foreground">
              {product.volumeMl}ml · {product.abv}% ABV
            </span>
            <span className="flex items-baseline gap-2">
              <span className="font-serif text-xl text-foreground">
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
            aria-label={`Add ${product.name} to cart`}
            onClick={() =>
              toast.success("Added to cart", {
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
