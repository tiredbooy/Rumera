"use client"

import Link from "next/link"
import Image from "next/image"
import { Minus, Plus, Trash2, AlertTriangle, Wine } from "lucide-react"

import { cn } from "@/lib/utils"
import { formatPrice, faNum } from "@/lib/products"
import { Button } from "@/components/ui/button"
import { Bottle } from "@/components/bottle"
import { useCart, useUpdateCartItem, useRemoveCartItem } from "@/lib/api/hooks"

/**
 * Live cart line items, shared by the drawer and the full cart page. Quantity
 * steppers and removal hit the server cart; the `price_changed` flag surfaces a
 * warning when a snapshotted price has drifted.
 */
export function CartLines({ enabled = true }: { enabled?: boolean }) {
  const { data: cart, isLoading } = useCart(enabled)
  const update = useUpdateCartItem()
  const remove = useRemoveCartItem()
  const busy = update.isPending || remove.isPending

  if (isLoading) {
    // Reserve space with skeleton rows to avoid layout shift.
    return (
      <ul className="flex flex-col divide-y divide-border/60" aria-hidden>
        {[0, 1, 2].map((i) => (
          <li key={i} className="flex gap-4 py-5">
            <div className="size-20 shrink-0 animate-pulse rounded-xl bg-muted/60" />
            <div className="flex flex-1 flex-col gap-2.5 py-1">
              <div className="h-4 w-2/3 animate-pulse rounded bg-muted/60" />
              <div className="h-3 w-1/3 animate-pulse rounded bg-muted/50" />
              <div className="mt-auto flex items-center justify-between">
                <div className="h-8 w-24 animate-pulse rounded-lg bg-muted/50" />
                <div className="h-4 w-16 animate-pulse rounded bg-muted/60" />
              </div>
            </div>
          </li>
        ))}
      </ul>
    )
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
        <span className="mb-5 flex size-16 items-center justify-center rounded-2xl bg-secondary text-primary ring-1 ring-primary/15">
          <Wine className="size-7" />
        </span>
        <p className="font-serif text-2xl">سبد خرید شما خالی است</p>
        <p className="mt-2 max-w-xs text-sm text-muted-foreground">
          هنوز بطری‌ای انتخاب نکرده‌اید. مجموعهٔ منتخب ما را کشف کنید.
        </p>
        <Button asChild className="mt-6">
          <Link href="/products">کاوش در فروشگاه</Link>
        </Button>
      </div>
    )
  }

  return (
    <ul className="flex flex-col divide-y divide-border/60">
      {cart.items.map((item) => (
        <li key={item.id} className="flex gap-4 py-5">
          <div className="relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-secondary/60 ring-1 ring-border/60">
            {item.image_url ? (
              <Image src={item.image_url} alt={item.product_title} fill sizes="80px" className="object-contain p-2" />
            ) : (
              <Bottle product={{ id: item.variant_id, maker: item.product_title }} className="h-16" />
            )}
          </div>

          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-medium leading-snug">{item.product_title}</p>
                {item.options?.length ? (
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {item.options.map((o) => o.value).join(" · ")}
                  </p>
                ) : null}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="size-9 shrink-0 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                aria-label={`حذف ${item.product_title}`}
                disabled={busy}
                onClick={() => remove.mutate(item.id)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>

            {item.price_changed ? (
              <p className="mt-1.5 inline-flex w-fit items-center gap-1 rounded-md bg-wine/10 px-2 py-0.5 text-xs text-wine">
                <AlertTriangle className="size-3" /> قیمت به‌روزرسانی شد: {formatPrice(item.current_price)}
              </p>
            ) : null}

            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-center gap-0.5 rounded-lg border border-border bg-background/50 p-0.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-9 rounded-md"
                  aria-label="کاهش تعداد"
                  disabled={busy || item.quantity <= 1}
                  onClick={() => update.mutate({ itemId: item.id, quantity: item.quantity - 1 })}
                >
                  <Minus className="size-3.5" />
                </Button>
                <span className="w-8 text-center text-sm font-medium tabular-nums">{faNum(item.quantity)}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-9 rounded-md"
                  aria-label="افزایش تعداد"
                  disabled={busy}
                  onClick={() => update.mutate({ itemId: item.id, quantity: item.quantity + 1 })}
                >
                  <Plus className="size-3.5" />
                </Button>
              </div>
              <span className={cn("font-medium tabular-nums transition-opacity", busy && "opacity-50")}>
                {formatPrice(item.line_total)}
              </span>
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}
