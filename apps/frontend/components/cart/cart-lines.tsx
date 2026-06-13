"use client"

import Image from "next/image"
import { Minus, Plus, Trash2, AlertTriangle, Loader2, ShoppingBag } from "lucide-react"

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
    return (
      <div className="flex justify-center py-10 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    )
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <span className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          <ShoppingBag className="size-6" />
        </span>
        <p className="font-medium">سبد خرید شما خالی است</p>
        <p className="mt-1 text-sm text-muted-foreground">بطری‌های منتخب را به سبد اضافه کنید.</p>
      </div>
    )
  }

  return (
    <ul className="flex flex-col divide-y divide-border/60">
      {cart.items.map((item) => (
        <li key={item.id} className="flex gap-4 py-4">
          <div className="relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted/50">
            {item.image_url ? (
              <Image src={item.image_url} alt={item.product_title} fill sizes="80px" className="object-contain p-1.5" />
            ) : (
              <Bottle product={{ id: item.variant_id, maker: item.product_title }} className="h-16" />
            )}
          </div>

          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-medium">{item.product_title}</p>
                {item.options?.length ? (
                  <p className="truncate text-xs text-muted-foreground">
                    {item.options.map((o) => o.value).join(" · ")}
                  </p>
                ) : null}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                aria-label="حذف"
                disabled={busy}
                onClick={() => remove.mutate(item.id)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>

            {item.price_changed ? (
              <p className="mt-1 inline-flex items-center gap-1 text-xs text-wine">
                <AlertTriangle className="size-3" /> قیمت به‌روزرسانی شد: {formatPrice(item.current_price)}
              </p>
            ) : null}

            <div className="mt-2 flex items-center justify-between">
              <div className="flex items-center gap-1 rounded-lg border border-border">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  aria-label="کاهش"
                  disabled={busy || item.quantity <= 1}
                  onClick={() => update.mutate({ itemId: item.id, quantity: item.quantity - 1 })}
                >
                  <Minus className="size-3.5" />
                </Button>
                <span className="w-7 text-center text-sm tabular-nums">{faNum(item.quantity)}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  aria-label="افزایش"
                  disabled={busy}
                  onClick={() => update.mutate({ itemId: item.id, quantity: item.quantity + 1 })}
                >
                  <Plus className="size-3.5" />
                </Button>
              </div>
              <span className={cn("font-medium", busy && "opacity-60")}>{formatPrice(item.line_total)}</span>
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}
