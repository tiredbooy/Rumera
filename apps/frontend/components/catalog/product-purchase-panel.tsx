"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { formatPrice } from "@/lib/products"
import type { ProductDetail, Variant } from "@/lib/catalog/types"
import { AddToCartButton } from "./add-to-cart-button"

const variantLabel = (v: Variant) => v.options?.map((o) => o.value).join(" · ") || v.sku

/** Client-side variant picker + price + add-to-cart for the product page. */
export function ProductPurchasePanel({ product }: { product: ProductDetail }) {
  const variants = (product.variants ?? []).filter((v) => v.is_active)
  const [selectedId, setSelectedId] = React.useState<number | undefined>(variants[0]?.id)
  const selected = variants.find((v) => v.id === selectedId) ?? variants[0]
  const onSale = selected?.compare_at_price && selected.compare_at_price > selected.price

  return (
    <div>
      {variants.length > 1 ? (
        <div className="mb-6">
          <p className="mb-2 text-sm text-muted-foreground">انتخاب گزینه</p>
          <div className="flex flex-wrap gap-2">
            {variants.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setSelectedId(v.id)}
                className={cn(
                  "rounded-xl border px-4 py-2 text-sm transition-colors",
                  v.id === selectedId
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:border-primary/40"
                )}
              >
                {variantLabel(v)}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {selected ? (
        <div className="flex items-baseline gap-3">
          <span className="font-serif text-4xl text-foil">{formatPrice(selected.price)}</span>
          {onSale ? (
            <span className="text-muted-foreground line-through">
              {formatPrice(selected.compare_at_price!)}
            </span>
          ) : null}
        </div>
      ) : (
        <p className="text-muted-foreground">این محصول در حال حاضر ناموجود است.</p>
      )}

      <div className="mt-7">
        <AddToCartButton productVariantId={selected?.id} disabled={!selected} />
      </div>
    </div>
  )
}
