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
      className="group/product press border-hairline shadow-e1 hover:shadow-e3 relative flex h-full flex-col overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/5 transition-[transform,box-shadow,border-color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1 hover:ring-primary/30 sm:rounded-3xl"
    >
      <div className="relative flex h-44 items-end justify-center overflow-hidden sm:h-56">
        <div
          className="absolute inset-0 opacity-90 transition-opacity duration-300 group-hover/product:opacity-100"
          style={{ background: `radial-gradient(75% 60% at 50% 120%, ${hue[0]}, transparent 70%)` }}
        />
        {/* Sheen sweep on hover — premium catch-light across the bottle stage. */}
        <span
          aria-hidden
          className="sheen pointer-events-none absolute inset-0 -translate-x-full opacity-0 transition-all duration-700 ease-out group-hover/product:translate-x-full group-hover/product:opacity-100 motion-reduce:hidden"
        />
        <Bottle
          product={{ id: product.id, hue, maker: product.brand }}
          className="relative h-36 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/product:-translate-y-1.5 group-hover/product:scale-105 sm:h-48"
        />
      </div>

      <div className="flex flex-1 flex-col gap-1.5 border-t border-border/60 p-4 sm:gap-2 sm:p-5">
        {product.brand ? (
          <span className="truncate text-[11px] font-medium text-primary sm:text-xs">
            {product.brand}
          </span>
        ) : null}
        <h3 className="line-clamp-2 font-serif text-base leading-tight transition-colors group-hover/product:text-primary sm:text-xl">
          {product.title}
        </h3>
        <div className="mt-auto flex items-end justify-between gap-2 pt-1.5 sm:pt-2">
          <span className="flex min-w-0 flex-col leading-tight">
            {ranged ? (
              <span className="text-[10px] text-muted-foreground sm:text-[11px]">از</span>
            ) : null}
            <span className="truncate font-serif text-base text-foreground sm:text-lg">
              {formatPrice(product.min_price)}
            </span>
          </span>
          <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary transition-opacity sm:text-sm sm:opacity-0 sm:group-hover/product:opacity-100">
            مشاهده <ArrowLeft className="size-4 transition-transform group-hover/product:-translate-x-0.5" />
          </span>
        </div>
      </div>
    </Link>
  )
}
