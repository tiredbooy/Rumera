"use client"

import Link from "next/link"
import { useSession } from "next-auth/react"
import { ArrowLeft, LogIn, ShieldCheck, Truck, Tag, Lock } from "lucide-react"

import { formatPrice, faNum } from "@/lib/products"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { useCart } from "@/lib/api/hooks"
import { CartLines } from "./cart-lines"

/** Full cart page body (client). Server page wraps it for metadata/noindex. */
export function CartView() {
  const { status } = useSession()
  const authed = status === "authenticated"
  const { data: cart } = useCart(authed)
  const hasItems = !!cart && cart.items.length > 0
  const itemCount = cart?.summary.total_items ?? 0

  if (status === "unauthenticated") {
    return (
      <div className="border-hairline mt-10 flex flex-col items-center rounded-3xl bg-card/60 px-6 py-16 text-center backdrop-blur-sm ring-1 ring-foreground/5">
        <span className="mb-5 flex size-14 items-center justify-center rounded-2xl bg-secondary text-primary ring-1 ring-primary/15">
          <LogIn className="size-6" />
        </span>
        <p className="font-serif text-2xl">برای مشاهدهٔ سبد خرید وارد شوید</p>
        <p className="mt-2 max-w-xs text-sm text-muted-foreground">
          سبد خرید شما به حساب کاربری‌تان متصل است و در همهٔ دستگاه‌ها همگام می‌ماند.
        </p>
        <Button asChild className="mt-6">
          <Link href="/login?callbackUrl=/cart">ورود به حساب</Link>
        </Button>
      </div>
    )
  }

  const summary = (
    <>
      <h2 className="font-serif text-2xl">خلاصهٔ سفارش</h2>

      <div className="mt-5 space-y-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">
            جمع جزء {hasItems ? `(${faNum(itemCount)} قلم)` : ""}
          </span>
          <span className="font-medium tabular-nums">{formatPrice(cart?.summary.subtotal ?? 0)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">هزینهٔ ارسال</span>
          <span className="text-muted-foreground">در مرحلهٔ تسویه</span>
        </div>
      </div>

      <Separator className="my-5" />

      <div className="flex items-baseline justify-between">
        <span className="font-medium">مبلغ تقریبی</span>
        <span className="font-serif text-2xl text-foil tabular-nums">
          {formatPrice(cart?.summary.subtotal ?? 0)}
        </span>
      </div>

      <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-secondary/60 px-3 py-2 text-xs text-muted-foreground">
        <Tag className="mt-px size-3.5 shrink-0 text-primary" />
        کد تخفیف و کارت هدیه را در مرحلهٔ تسویه اعمال کنید.
      </p>

      <Button asChild size="lg" className="mt-5 h-12 w-full" disabled={!hasItems}>
        {hasItems ? (
          <Link href="/checkout">
            ادامه به تسویه <ArrowLeft />
          </Link>
        ) : (
          <span>
            ادامه به تسویه <ArrowLeft />
          </span>
        )}
      </Button>
      <Button asChild variant="ghost" size="sm" className="mt-2 w-full">
        <Link href="/products">ادامهٔ خرید</Link>
      </Button>

      <ul className="mt-6 space-y-2.5 border-t border-border/60 pt-5 text-xs text-muted-foreground">
        <li className="flex items-center gap-2">
          <ShieldCheck className="size-4 shrink-0 text-primary" /> پرداخت امن و رمزگذاری‌شده
        </li>
        <li className="flex items-center gap-2">
          <Truck className="size-4 shrink-0 text-primary" /> ارسال محتاطانه و بسته‌بندی محافظت‌شده
        </li>
      </ul>
    </>
  )

  return (
    <div className="mt-10 grid gap-8 lg:grid-cols-[1.6fr_1fr]">
      <div className="border-hairline rounded-3xl bg-card px-5 ring-1 ring-foreground/5 sm:px-6">
        <CartLines enabled={authed} />
      </div>

      {/* Desktop sticky summary rail */}
      <aside className="hidden h-fit lg:sticky lg:top-24 lg:block">
        <div className="border-hairline shadow-e2 relative overflow-hidden rounded-3xl bg-card p-6 ring-1 ring-foreground/5">
          <div aria-hidden className="rule-gold absolute inset-x-6 top-0" />
          {summary}
        </div>
      </aside>

      {/* Mobile: full summary inline, plus a sticky bottom checkout bar */}
      <div className="lg:hidden">
        <div className="border-hairline shadow-e2 relative overflow-hidden rounded-3xl bg-card p-6 ring-1 ring-foreground/5">
          <div aria-hidden className="rule-gold absolute inset-x-6 top-0" />
          {summary}
        </div>
      </div>

      {hasItems ? (
        <div className="border-hairline fixed inset-x-0 bottom-0 z-30 flex items-center gap-3 bg-background/90 px-5 py-3 backdrop-blur-xl ring-1 ring-foreground/10 lg:hidden">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">مبلغ تقریبی</p>
            <p className="truncate font-serif text-lg text-foil tabular-nums">
              {formatPrice(cart?.summary.subtotal ?? 0)}
            </p>
          </div>
          <Button asChild size="lg" className="h-12 flex-1">
            <Link href="/checkout">
              <Lock className="size-4" /> تسویه
            </Link>
          </Button>
        </div>
      ) : null}
    </div>
  )
}
