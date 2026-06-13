"use client"

import * as React from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { ShoppingBag, ArrowLeft } from "lucide-react"

import { formatPrice, faNum } from "@/lib/products"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
  SheetTrigger,
} from "@/components/ui/sheet"
import { useCart } from "@/lib/api/hooks"
import { CartLines } from "./cart-lines"

/** Header cart control: icon + live count badge + slide-over drawer. */
export function CartButton() {
  const { status } = useSession()
  const authed = status === "authenticated"
  const { data: cart } = useCart(authed)
  const count = cart?.summary.total_items ?? 0
  const [open, setOpen] = React.useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="سبد خرید" className="relative">
          <ShoppingBag />
          {count > 0 ? (
            <Badge className="absolute -top-0.5 -end-0.5 size-4 rounded-full p-0 text-[10px] tabular-nums">
              {faNum(count)}
            </Badge>
          ) : null}
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="flex w-full flex-col p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border/60 px-5 py-4">
          <SheetTitle className="font-serif text-2xl">سبد خرید</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5">
          {authed ? (
            <CartLines enabled={open} />
          ) : (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <p className="font-medium">برای مشاهدهٔ سبد وارد شوید</p>
              <Button asChild className="mt-5" onClick={() => setOpen(false)}>
                <Link href="/login?callbackUrl=/cart">ورود به حساب</Link>
              </Button>
            </div>
          )}
        </div>

        {authed && count > 0 ? (
          <SheetFooter className="border-t border-border/60 px-5 py-4">
            <div className="mb-3 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">جمع جزء</span>
              <span className="font-serif text-xl">{formatPrice(cart!.summary.subtotal)}</span>
            </div>
            <Button asChild size="lg" className="h-12 w-full" onClick={() => setOpen(false)}>
              <Link href="/checkout">
                ادامه به تسویه <ArrowLeft />
              </Link>
            </Button>
          </SheetFooter>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
