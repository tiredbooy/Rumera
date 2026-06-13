import Link from "next/link"
import { notFound } from "next/navigation"
import { CheckCircle2 } from "lucide-react"

import { serverApi } from "@/lib/api/client"
import { faNum, formatPrice } from "@/lib/products"
import type { Order, OrderStatus } from "@/lib/catalog/types"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

const STATUS_FA: Partial<Record<OrderStatus, string>> = {
  pending: "در انتظار پرداخت",
  paid: "پرداخت‌شده",
  processing: "در حال پردازش",
  ready_to_ship: "آمادهٔ ارسال",
  shipped: "ارسال‌شده",
  delivered: "تحویل‌شده",
  cancelled: "لغوشده",
}

async function getOrder(id: string): Promise<Order | null> {
  try {
    return await serverApi<Order>(`/orders/${id}`)
  } catch {
    return null
  }
}

export default async function OrderConfirmationPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const order = await getOrder(id)
  if (!order) notFound()

  return (
    <section className="container-px mx-auto max-w-3xl py-16">
      <div className="text-center">
        <span className="mx-auto mb-5 flex size-16 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-500">
          <CheckCircle2 className="size-8" />
        </span>
        <h1 className="font-serif text-4xl">سفارش شما ثبت شد</h1>
        <p className="mt-2 text-muted-foreground">
          شمارهٔ سفارش: #{faNum(order.id)} ·{" "}
          <Badge variant="secondary">{STATUS_FA[order.status] ?? order.status}</Badge>
        </p>
      </div>

      <div className="border-hairline mt-10 rounded-2xl bg-card p-6 ring-1 ring-foreground/5">
        <h2 className="font-serif text-2xl">اقلام سفارش</h2>
        <ul className="mt-4 divide-y divide-border/60">
          {order.items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 py-3">
              <span className="min-w-0">
                <span className="block truncate font-medium">{item.product_title}</span>
                <span className="text-xs text-muted-foreground">
                  {faNum(item.quantity)} × {formatPrice(item.unit_price)}
                </span>
              </span>
              <span className="font-medium">{formatPrice(item.total_price)}</span>
            </li>
          ))}
        </ul>

        <dl className="mt-5 space-y-2 border-t border-border/60 pt-5 text-sm">
          <Row label="جمع جزء" value={formatPrice(order.subtotal)} />
          {order.discount_amount > 0 ? <Row label="تخفیف" value={`− ${formatPrice(order.discount_amount)}`} /> : null}
          <Row label="ارسال" value={order.shipping_cost > 0 ? formatPrice(order.shipping_cost) : "رایگان"} />
          <div className="flex items-center justify-between border-t border-border/60 pt-3">
            <dt className="font-medium">مبلغ کل</dt>
            <dd className="font-serif text-xl text-foil">{formatPrice(order.total_amount)}</dd>
          </div>
        </dl>
      </div>

      <div className="mt-8 flex justify-center gap-3">
        <Button asChild>
          <Link href="/account/orders">سفارش‌های من</Link>
        </Button>
        <Button asChild variant="outline">
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
