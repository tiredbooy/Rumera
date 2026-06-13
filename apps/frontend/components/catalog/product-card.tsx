import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { formatPrice } from "@/lib/products"
import type { ProductListItem } from "@/lib/catalog/types"
import { Bottle } from "@/components/bottle"

// The list endpoint carries no imagery, so cards use the Bottle visual; vary the
// hue by id for a lively grid (real photography shows on the product page).
const HUES: [string, string][] = [
  ["oklch(0.62 0.13 65)", "oklch(0.32 0.08 50)"],
  ["oklch(0.45 0.16 18)", "oklch(0.24 0.08 20)"],
  ["oklch(0.82 0.1 95)", "oklch(0.55 0.09 80)"],
  ["oklch(0.7 0.11 200)", "oklch(0.4 0.08 220)"],
  ["oklch(0.55 0.13 55)", "oklch(0.3 0.07 45)"],
  ["oklch(0.78 0.12 110)", "oklch(0.5 0.1 120)"],
]

/** Storefront product card for live `ProductListItem` data. Links to the PDP. */
export function ProductCard({ product }: { product: ProductListItem }) {
  const hue = HUES[product.id % HUES.length]
  const ranged = product.max_price > product.min_price

  return (
    <Link
      href={`/products/${product.slug}`}
      className="group/product border-hairline relative flex flex-col overflow-hidden rounded-3xl bg-card ring-1 ring-foreground/5 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:ring-primary/30"
    >
      <div className="relative flex h-56 items-end justify-center overflow-hidden">
        <div
          className="absolute inset-0 opacity-90 transition-opacity duration-300 group-hover/product:opacity-100"
          style={{ background: `radial-gradient(75% 60% at 50% 120%, ${hue[0]}, transparent 70%)` }}
        />
        <Bottle
          product={{ id: product.id, hue, maker: product.brand }}
          className="relative h-48 transition-transform duration-500 group-hover/product:-translate-y-1 group-hover/product:scale-105"
        />
      </div>

      <div className="flex flex-1 flex-col gap-2 border-t border-border/60 p-5">
        {product.brand ? (
          <span className="text-xs text-muted-foreground">{product.brand}</span>
        ) : null}
        <h3 className="font-serif text-xl leading-tight">{product.title}</h3>
        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          <span className="font-serif text-lg text-foreground">
            {ranged ? "از " : ""}
            {formatPrice(product.min_price)}
          </span>
          <span className="inline-flex items-center gap-1 text-sm text-primary opacity-0 transition-opacity group-hover/product:opacity-100">
            مشاهده <ArrowLeft className="size-4" />
          </span>
        </div>
      </div>
    </Link>
  )
}
