"use client"

import * as React from "react"
import { useSession } from "next-auth/react"
import { Heart } from "lucide-react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { formatPrice } from "@/lib/products"
import type { ProductDetail, Variant } from "@/lib/catalog/types"
import {
  useWishlist,
  useAddWishlistItem,
  useRemoveWishlistItem,
} from "@/lib/api/hooks"
import { AddToCartButton } from "./add-to-cart-button"
import { AlertButton } from "./alert-button"

const variantLabel = (v: Variant) => v.options?.map((o) => o.value).join(" · ") || v.sku

/** Client-side variant picker + price + add-to-cart for the product page. */
export function ProductPurchasePanel({ product }: { product: ProductDetail }) {
  const variants = (product.variants ?? []).filter((v) => v.is_active)
  const [selectedId, setSelectedId] = React.useState<number | undefined>(variants[0]?.id)
  const selected = variants.find((v) => v.id === selectedId) ?? variants[0]
  const onSale = selected?.compare_at_price && selected.compare_at_price > selected.price

  // Wishlist — keyed by variant; remove needs the wishlist-item row id.
  const { status } = useSession()
  const authed = status === "authenticated"
  const wishlist = useWishlist(authed)
  const addWish = useAddWishlistItem()
  const removeWish = useRemoveWishlistItem()
  const wishItem = wishlist.data?.items.find((i) => i.variant_id === selected?.id)
  const inWishlist = !!wishItem
  const wishPending = addWish.isPending || removeWish.isPending

  function toggleWishlist() {
    if (!authed) {
      toast.info("برای افزودن به علاقه‌مندی‌ها وارد شوید")
      return
    }
    if (!selected) return
    if (wishItem) {
      removeWish.mutate(wishItem.id, {
        onSuccess: () => toast.success("از علاقه‌مندی‌ها حذف شد"),
        onError: () => toast.error("حذف ناموفق بود"),
      })
    } else {
      addWish.mutate(selected.id, {
        onSuccess: () => toast.success("به علاقه‌مندی‌ها افزوده شد"),
        onError: () => toast.error("افزودن ناموفق بود"),
      })
    }
  }

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

      <div className="mt-7 flex flex-wrap items-center gap-3">
        <AddToCartButton productVariantId={selected?.id} disabled={!selected} />
        <AlertButton productVariantId={selected?.id} />
        <button
          type="button"
          onClick={toggleWishlist}
          disabled={!selected || wishPending}
          aria-pressed={inWishlist}
          aria-label={inWishlist ? "حذف از علاقه‌مندی‌ها" : "افزودن به علاقه‌مندی‌ها"}
          className={cn(
            "inline-flex size-11 cursor-pointer items-center justify-center rounded-xl border transition-colors disabled:opacity-50",
            inWishlist
              ? "border-wine/40 bg-wine/10 text-wine"
              : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
          )}
        >
          <Heart className={cn("size-5", inWishlist && "fill-wine")} />
        </button>
      </div>
    </div>
  )
}
