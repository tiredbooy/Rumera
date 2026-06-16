"use client"

import Link from "next/link"
import { toast } from "sonner"
import { Heart, Plus, ShoppingCart, Check, Ban } from "lucide-react"

import { faNum, formatPrice } from "@/lib/products"
import type { WishlistItem } from "@/lib/catalog/types"
import { useWishlist, useRemoveWishlistItem, useAddCartItem } from "@/lib/api/hooks"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { SmartImage } from "@/components/smart-image"
import { EmptyState } from "./empty-state"

// The wishlist API carries no slug, so cards link to a title search rather than
// straight to the PDP (a small backend change to add `slug` would fix this).
const searchHref = (title: string) => `/search?q=${encodeURIComponent(title)}`

export function WishlistView() {
  const wishlist = useWishlist()
  const removeItem = useRemoveWishlistItem()
  const addCart = useAddCartItem()
  const items = wishlist.data?.items ?? []

  function remove(item: WishlistItem) {
    removeItem.mutate(item.id, {
      onSuccess: () => toast.success("از علاقه‌مندی‌ها حذف شد"),
      onError: () => toast.error("حذف ناموفق بود"),
    })
  }

  function addToCart(item: WishlistItem) {
    addCart.mutate(
      { product_variant_id: item.variant_id, quantity: 1 },
      {
        onSuccess: () =>
          toast.success("به سبد خرید افزوده شد", {
            description: `${item.product_title} — ${formatPrice(item.price)}`,
          }),
        onError: () => toast.error("افزودن به سبد ناموفق بود"),
      }
    )
  }

  function addAllToCart() {
    const inStock = items.filter((i) => i.is_in_stock)
    if (inStock.length === 0) return
    inStock.forEach((i) => addCart.mutate({ product_variant_id: i.variant_id, quantity: 1 }))
    toast.success(`${faNum(inStock.length)} مورد به سبد خرید افزوده شد`)
  }

  if (wishlist.isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="aspect-[3/4] rounded-2xl sm:rounded-3xl" />
        ))}
      </div>
    )
  }

  if (wishlist.isError) {
    return (
      <div className="border-hairline rounded-2xl bg-card p-6 text-sm text-muted-foreground ring-1 ring-foreground/5">
        خطا در دریافت علاقه‌مندی‌ها.{" "}
        <button
          type="button"
          onClick={() => wishlist.refetch()}
          className="cursor-pointer font-medium text-primary hover:underline"
        >
          تلاش دوباره
        </button>
      </div>
    )
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
        <Button size="sm" variant="outline" onClick={addAllToCart} disabled={!items.some((i) => i.is_in_stock)}>
          <ShoppingCart className="size-4" /> افزودن همه به سبد
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((item) => {
          const onSale = item.compare_at_price && item.compare_at_price > item.price
          const discount = onSale
            ? Math.round((1 - item.price / item.compare_at_price!) * 100)
            : 0
          return (
            <article
              key={item.id}
              className="group/product hover-lift border-hairline relative flex h-full flex-col overflow-hidden rounded-2xl bg-card sm:rounded-3xl"
            >
              <div className="relative aspect-4/5 overflow-hidden">
                <Link href={searchHref(item.product_title)} className="absolute inset-0" aria-label={item.product_title}>
                  <div className="absolute inset-0 transition-transform duration-700 ease-out group-hover/product:scale-105">
                    <SmartImage
                      src={item.image_url}
                      alt={item.product_title}
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                      monogram={item.product_title.charAt(0)}
                      fallbackClassName="from-accent/40 via-card to-secondary"
                    />
                  </div>
                </Link>

                {onSale ? (
                  <div className="pointer-events-none absolute start-3 top-3 z-10 sm:start-4 sm:top-4">
                    <Badge className="bg-wine text-wine-foreground shadow-sm">٪{faNum(discount)}-</Badge>
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={() => remove(item)}
                  disabled={removeItem.isPending}
                  aria-label="حذف از علاقه‌مندی‌ها"
                  className="absolute end-3 top-3 z-10 flex size-9 cursor-pointer items-center justify-center rounded-full bg-background/80 text-wine shadow-sm backdrop-blur-md transition-all duration-300 hover:scale-110 hover:bg-wine hover:text-wine-foreground disabled:opacity-50 sm:end-4 sm:top-4"
                >
                  <Heart className="size-4 fill-current" />
                </button>

                {item.is_in_stock ? (
                  <div className="pointer-events-none absolute inset-x-3 bottom-3 z-10 hidden translate-y-3 opacity-0 transition-all duration-300 group-hover/product:translate-y-0 group-hover/product:opacity-100 [@media(hover:hover)]:block">
                    <Button
                      type="button"
                      className="pointer-events-auto h-11 w-full cursor-pointer rounded-2xl shadow-lg"
                      onClick={() => addToCart(item)}
                    >
                      <Plus /> افزودن به سبد
                    </Button>
                  </div>
                ) : null}
              </div>

              <div className="flex flex-1 flex-col gap-2 p-4 sm:gap-2.5 sm:p-5">
                <div className="flex items-center justify-end gap-2">
                  {item.is_in_stock ? (
                    <Badge variant="secondary" className="gap-1 px-2 py-0 text-[10px]">
                      <Check className="size-3" /> موجود
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1 px-2 py-0 text-[10px] text-muted-foreground">
                      <Ban className="size-3" /> ناموجود
                    </Badge>
                  )}
                </div>

                <h3 className="line-clamp-2 font-serif text-base leading-tight transition-colors group-hover/product:text-primary sm:text-lg">
                  <Link href={searchHref(item.product_title)}>{item.product_title}</Link>
                </h3>

                <div className="mt-auto flex items-end justify-between gap-2 pt-1.5 sm:pt-2">
                  <span className="flex flex-wrap items-baseline gap-x-1.5">
                    <span className="font-serif text-lg text-foreground sm:text-2xl">
                      {formatPrice(item.price)}
                    </span>
                    {onSale ? (
                      <span className="text-[10px] text-muted-foreground line-through sm:text-xs">
                        {formatPrice(item.compare_at_price!)}
                      </span>
                    ) : null}
                  </span>
                  {item.is_in_stock ? (
                    <Button
                      size="icon"
                      variant="secondary"
                      className="size-10 shrink-0 cursor-pointer rounded-xl transition-colors group-hover/product:bg-primary group-hover/product:text-primary-foreground sm:size-11 sm:rounded-2xl [@media(hover:hover)]:hidden"
                      aria-label={`افزودن ${item.product_title} به سبد خرید`}
                      onClick={() => addToCart(item)}
                    >
                      <Plus />
                    </Button>
                  ) : null}
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </>
  )
}
