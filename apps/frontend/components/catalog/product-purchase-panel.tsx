"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { useSession } from "next-auth/react"
import { Heart, Minus, Plus, Loader2, Check } from "lucide-react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { formatPrice, faNum } from "@/lib/products"
import type { ProductDetail, Variant } from "@/lib/catalog/types"
import {
  useWishlist,
  useAddWishlistItem,
  useRemoveWishlistItem,
  useRecordInteraction,
} from "@/lib/api/hooks"
import { AddToCartButton } from "./add-to-cart-button"
import { AlertButton } from "./alert-button"

const variantLabel = (v: Variant) => v.options?.map((o) => o.value).join(" · ") || v.sku
const MAX_QTY = 12

/**
 * ProductPurchasePanel — client-side buy box for the PDP. Owns variant selection,
 * a discount-aware price block (compare-at strikethrough + saving), a quantity
 * stepper, add-to-cart, restock/price alerts, and an optimistic, auth-aware
 * wishlist toggle. Also renders a sticky mobile action bar so the primary CTA
 * stays reachable while the long page scrolls.
 */
export function ProductPurchasePanel({ product }: { product: ProductDetail }) {
  const variants = (product.variants ?? []).filter((v) => v.is_active)
  const [selectedId, setSelectedId] = React.useState<number | undefined>(variants[0]?.id)
  const [qty, setQty] = React.useState(1)
  const selected = variants.find((v) => v.id === selectedId) ?? variants[0]

  const compareAt = selected?.compare_at_price
  const onSale = !!compareAt && compareAt > (selected?.price ?? 0)
  const discountPct =
    onSale && compareAt ? Math.round(((compareAt - selected!.price) / compareAt) * 100) : 0
  const saving = onSale && compareAt ? compareAt - selected!.price : 0

  // Portal the sticky mobile bar to <body> so ancestor backdrop-blur/overflow
  // (which establish a containing block) can't trap a position:fixed child.
  // useSyncExternalStore → hydration-safe client-only flag without an effect.
  const mounted = React.useSyncExternalStore(
    () => () => {},
    () => true, // client snapshot
    () => false // server snapshot
  )

  // Switching variant resets quantity (handled in the picker's onClick).
  function selectVariant(id: number) {
    setSelectedId(id)
    setQty(1)
  }

  // Wishlist — keyed by variant; remove needs the wishlist-item row id.
  const { status } = useSession()
  const authed = status === "authenticated"
  const wishlist = useWishlist(authed)
  const addWish = useAddWishlistItem()
  const removeWish = useRemoveWishlistItem()
  const record = useRecordInteraction()
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
        onSuccess: () => {
          toast.success("به علاقه‌مندی‌ها افزوده شد")
          // Warm personalisation — fire-and-forget, never blocks the UI.
          record.mutate({ product_id: product.id, interaction_type: "wishlist", source: "pdp" })
        },
        onError: () => toast.error("افزودن ناموفق بود"),
      })
    }
  }

  return (
    <div data-testid="purchase-panel">
      {variants.length > 1 ? (
        <fieldset className="mb-6">
          <legend className="mb-2 text-sm text-muted-foreground">انتخاب گزینه</legend>
          <div role="radiogroup" aria-label="انتخاب گزینهٔ محصول" className="flex flex-wrap gap-2">
            {variants.map((v) => {
              const isSel = v.id === selectedId
              return (
                <button
                  key={v.id}
                  type="button"
                  role="radio"
                  aria-checked={isSel}
                  onClick={() => selectVariant(v.id)}
                  className={cn(
                    "min-h-11 cursor-pointer rounded-xl border px-4 py-2 text-sm transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none",
                    isSel
                      ? "border-primary bg-primary/10 font-medium text-primary ring-1 ring-primary/30"
                      : "border-border hover:border-primary/40 hover:bg-accent/40"
                  )}
                >
                  {variantLabel(v)}
                </button>
              )
            })}
          </div>
        </fieldset>
      ) : null}

      {selected ? (
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
          <span className="font-serif text-4xl text-foil">{formatPrice(selected.price)}</span>
          {onSale ? (
            <>
              <span className="text-muted-foreground line-through" aria-label="قیمت پیشین">
                {formatPrice(compareAt!)}
              </span>
              <span className="inline-flex items-center rounded-full bg-wine/10 px-2.5 py-1 text-xs font-bold text-wine ring-1 ring-wine/20">
                {faNum(discountPct)}٪ تخفیف
              </span>
            </>
          ) : null}
        </div>
      ) : (
        <p className="text-muted-foreground">این محصول در حال حاضر ناموجود است.</p>
      )}

      {onSale ? (
        <p className="mt-1.5 text-sm text-wine">{formatPrice(saving)} صرفه‌جویی می‌کنید</p>
      ) : null}

      {/* Quantity + primary actions */}
      {selected ? (
        <div className="mt-7 space-y-4">
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground" id="qty-label">
              تعداد
            </span>
            <div
              className="inline-flex items-center rounded-xl border border-border bg-card"
              role="group"
              aria-labelledby="qty-label"
            >
              <button
                type="button"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                disabled={qty <= 1}
                aria-label="کاهش تعداد"
                className="flex size-11 cursor-pointer items-center justify-center rounded-r-xl text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Minus className="size-4" />
              </button>
              <span
                aria-live="polite"
                className="w-10 text-center text-sm font-semibold tabular-nums"
              >
                {faNum(qty)}
              </span>
              <button
                type="button"
                onClick={() => setQty((q) => Math.min(MAX_QTY, q + 1))}
                disabled={qty >= MAX_QTY}
                aria-label="افزایش تعداد"
                className="flex size-11 cursor-pointer items-center justify-center rounded-l-xl text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Plus className="size-4" />
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <AddToCartButton
              productVariantId={selected.id}
              quantity={qty}
              className="flex-1 sm:flex-none"
            />
            <AlertButton productVariantId={selected.id} />
            <WishlistToggle
              inWishlist={inWishlist}
              pending={wishPending}
              onToggle={toggleWishlist}
              disabled={!selected}
            />
          </div>
        </div>
      ) : (
        <div className="mt-7">
          <AlertButton productVariantId={undefined} />
        </div>
      )}

      {/* Sticky mobile bar — primary CTA stays in reach through the long page.
          Portaled to <body> so it's truly viewport-fixed. */}
      {mounted
        ? createPortal(
            <div
              className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/90 px-4 py-3 backdrop-blur-md lg:hidden [padding-bottom:calc(env(safe-area-inset-bottom)+0.75rem)]"
              aria-label="خرید سریع"
            >
              <div className="mx-auto flex max-w-7xl items-center gap-3">
                <div className="min-w-0 flex-1 leading-tight">
                  {selected ? (
                    <>
                      <p className="truncate font-serif text-lg text-foil">
                        {formatPrice(selected.price)}
                      </p>
                      {onSale ? (
                        <p className="truncate text-xs text-muted-foreground line-through">
                          {formatPrice(compareAt!)}
                        </p>
                      ) : null}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">ناموجود</p>
                  )}
                </div>
                <WishlistToggle
                  inWishlist={inWishlist}
                  pending={wishPending}
                  onToggle={toggleWishlist}
                  disabled={!selected}
                />
                <AddToCartButton
                  productVariantId={selected?.id}
                  quantity={qty}
                  disabled={!selected}
                  className="flex-[1.4]"
                />
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  )
}

/** Heart toggle shared by the inline panel and the sticky mobile bar. */
function WishlistToggle({
  inWishlist,
  pending,
  onToggle,
  disabled,
}: {
  inWishlist: boolean
  pending: boolean
  onToggle: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled || pending}
      aria-pressed={inWishlist}
      aria-label={inWishlist ? "حذف از علاقه‌مندی‌ها" : "افزودن به علاقه‌مندی‌ها"}
      className={cn(
        "inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-xl border transition-colors duration-200 disabled:opacity-50",
        inWishlist
          ? "border-wine/40 bg-wine/10 text-wine"
          : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
      )}
    >
      {pending ? (
        <Loader2 className="size-5 animate-spin" />
      ) : inWishlist ? (
        <span className="relative inline-flex">
          <Heart className="size-5 fill-wine" />
          <Check
            aria-hidden
            className="absolute -end-1.5 -top-1.5 size-3 rounded-full bg-wine p-px text-wine-foreground"
          />
        </span>
      ) : (
        <Heart className="size-5" />
      )}
    </button>
  )
}
