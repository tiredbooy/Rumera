"use client"

import Link from "next/link"
import { useSession } from "next-auth/react"
import { ArrowLeft } from "lucide-react"

import { formatPrice } from "@/lib/products"
import { Button } from "@/components/ui/button"
import { useCart } from "@/lib/api/hooks"
import { CartLines } from "./cart-lines"

/** Full cart page body (client). Server page wraps it for metadata/noindex. */
export function CartView() {
  const { status } = useSession()
  const authed = status === "authenticated"
  const { data: cart } = useCart(authed)
  const hasItems = !!cart && cart.items.length > 0

  if (status === "unauthenticated") {
    return (
      <div className="border-hairline mt-8 flex flex-col items-center rounded-2xl bg-card/40 px-6 py-14 text-center">
        <p className="font-medium">برای مشاهدهٔ سبد خرید وارد شوید</p>
        <Button asChild className="mt-5">
          <Link href="/login?callbackUrl=/cart">ورود به حساب</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[1.6fr_1fr]">
      <div className="border-hairline rounded-2xl bg-card px-5 ring-1 ring-foreground/5">
        <CartLines enabled={authed} />
      </div>

      <aside className="h-fit lg:sticky lg:top-24">
        <div className="border-hairline rounded-2xl bg-card p-6 ring-1 ring-foreground/5">
          <h2 className="font-serif text-2xl">خلاصهٔ سفارش</h2>
          <div className="mt-5 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">جمع جزء</span>
            <span className="font-medium">{formatPrice(cart?.summary.subtotal ?? 0)}</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">هزینهٔ ارسال در مرحلهٔ تسویه محاسبه می‌شود.</p>
          <Button asChild size="lg" className="mt-6 h-12 w-full" disabled={!hasItems}>
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
        </div>
      </aside>
    </div>
  )
}
