import Link from "next/link"
import { notFound } from "next/navigation"
import { CheckCircle2, Gift, Truck, Package, ArrowLeft, Mail } from "lucide-react"

import { ApiError } from "@/lib/api/client"
import { faNum, formatPrice } from "@/lib/products"
import { getAccountOrder } from "@/features/orders/api/account"
import { ORDER_STATUS_FA } from "@/features/orders/labels"
import type { Order } from "@/features/orders/types"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"

async function getOrder(id: number): Promise<Order | null> {
  try {
    return await getAccountOrder(id)
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null
    throw error
  }
}

export default async function OrderConfirmationPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const orderId = Number(id)
  if (!Number.isInteger(orderId) || orderId <= 0) notFound()
  const order = await getOrder(orderId)
  if (!order) notFound()

  const scheduled = order.scheduled_delivery_date
    ? new Date(order.scheduled_delivery_date).toLocaleDateString("fa-IR", {
        weekday: "long",
        day: "numeric",
        month: "long",
      })
    : null

  return (
    <section className="container-px mx-auto max-w-3xl py-14 lg:py-20">
      {/* Celebratory hero — elegant, candle-lit */}
      <div className="cellar-glow border-hairline relative overflow-hidden rounded-3xl px-6 py-12 text-center ring-1 ring-foreground/10">
        <span className="mx-auto mb-6 flex size-20 items-center justify-center rounded-full bg-primary/15 text-primary ring-1 ring-primary/25">
          <CheckCircle2 className="size-10" />
        </span>
        <p className="eyebrow">سفارش تأیید شد</p>
        <h1 className="mt-2 font-serif text-4xl sm:text-5xl">سپاس از خرید شما</h1>
        <p className="mx-auto mt-3 max-w-md text-muted-foreground">
          سفارش شما با موفقیت ثبت شد. جزئیات را برای پیگیری در دسترس نگه داشته‌ایم.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full bg-background/70 px-4 py-1.5 text-sm font-medium backdrop-blur-sm ring-1 ring-foreground/10">
            شمارهٔ سفارش: <span className="text-foil tabular-nums">#{faNum(order.id)}</span>
          </span>
          <Badge variant="secondary">{ORDER_STATUS_FA[order.status]}</Badge>
        </div>
      </div>

      {/* Delivery estimate / next info strip */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="border-hairline flex items-start gap-3 rounded-2xl bg-card p-5 ring-1 ring-foreground/5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
            <Truck className="size-5" />
          </span>
          <div>
            <p className="font-medium">زمان تحویل تخمینی</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {scheduled ? `تحویل برنامه‌ریزی‌شده برای ${scheduled}` : "۲ تا ۵ روز کاری پس از تأیید پرداخت"}
            </p>
          </div>
        </div>
        <div className="border-hairline flex items-start gap-3 rounded-2xl bg-card p-5 ring-1 ring-foreground/5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
            <Mail className="size-5" />
          </span>
          <div>
            <p className="font-medium">به‌روزرسانی وضعیت</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              تغییرات وضعیت سفارش را از بخش «سفارش‌های من» دنبال کنید.
            </p>
          </div>
        </div>
      </div>

      {order.is_gift ? (
        <div className="border-hairline mt-6 rounded-2xl bg-card px-6 py-5 ring-1 ring-foreground/5">
          <p className="flex items-center gap-2 font-medium text-primary">
            <Gift className="size-4" /> این سفارش به‌عنوان هدیه ثبت شد
          </p>
          {order.gift_message ? (
            <p className="mt-2 text-sm text-muted-foreground">«{order.gift_message}»</p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {order.gift_wrap ? <span>با بسته‌بندی هدیه</span> : null}
            {order.hide_price ? <span>قیمت در رسید مخفی می‌شود</span> : null}
            {scheduled ? <span>تاریخ تحویل: {scheduled}</span> : null}
          </div>
        </div>
      ) : null}

      <div className="border-hairline mt-6 rounded-2xl bg-card p-6 ring-1 ring-foreground/5">
        <h2 className="flex items-center gap-2 font-serif text-2xl">
          <Package className="size-5 text-primary" /> اقلام سفارش
        </h2>
        <ul className="mt-4 divide-y divide-border/60">
          {order.items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 py-3">
              <span className="min-w-0">
                <span className="block truncate font-medium">{item.product_title}</span>
                <span className="text-xs text-muted-foreground">
                  {faNum(item.quantity)} × {formatPrice(item.unit_price)}
                </span>
              </span>
              <span className="font-medium tabular-nums">{formatPrice(item.total_price)}</span>
            </li>
          ))}
        </ul>

        <Separator className="my-5" />

        <dl className="space-y-2 text-sm">
          <Row label="جمع جزء" value={formatPrice(order.subtotal)} />
          {order.discount_amount > 0 ? <Row label="تخفیف" value={`− ${formatPrice(order.discount_amount)}`} /> : null}
          <Row label="ارسال" value={order.shipping_cost > 0 ? formatPrice(order.shipping_cost) : "رایگان"} />
          <div className="flex items-center justify-between border-t border-border/60 pt-3">
            <dt className="font-medium">مبلغ کل</dt>
            <dd className="font-serif text-xl text-foil tabular-nums">{formatPrice(order.total_amount)}</dd>
          </div>
        </dl>
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Button asChild size="lg" className="h-12">
          <Link href={`/account/orders/${order.id}`}>
            پیگیری سفارش <ArrowLeft />
          </Link>
        </Button>
        <Button asChild size="lg" variant="outline" className="h-12">
          <Link href="/products">ادامهٔ خرید</Link>
        </Button>
      </div>
    </section>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}
