"use client"

import { toast } from "sonner"
import { Loader2, XCircle } from "lucide-react"

import { faNum, formatPrice } from "@/lib/products"
import { ORDER_STATUS_FA, PAYMENT_FA, isCancellable, faDate } from "@/lib/catalog/labels"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useOrder, useCancelOrder } from "@/lib/api/hooks"

export function OrderDetail({ id }: { id: string }) {
  const { data: order, isLoading, isError } = useOrder(id)
  const cancel = useCancelOrder()

  if (isLoading) {
    return (
      <div className="flex justify-center py-12 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    )
  }
  if (isError || !order) {
    return <p className="text-muted-foreground">سفارش یافت نشد.</p>
  }

  return (
    <div className="border-hairline rounded-2xl bg-card p-6 ring-1 ring-foreground/5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Badge variant={order.status === "cancelled" ? "destructive" : "secondary"}>
            {ORDER_STATUS_FA[order.status] ?? order.status}
          </Badge>
          <span className="text-sm text-muted-foreground">{faDate(order.created_at)}</span>
          <span className="text-sm text-muted-foreground">· {PAYMENT_FA[order.payment_method]}</span>
        </div>
        {isCancellable(order.status) ? (
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive"
            disabled={cancel.isPending}
            onClick={() =>
              cancel.mutate(order.id, {
                onSuccess: () => toast.success("سفارش لغو شد"),
                onError: () => toast.error("لغو سفارش ناموفق بود"),
              })
            }
          >
            {cancel.isPending ? <Loader2 className="size-4 animate-spin" /> : <XCircle className="size-4" />}
            لغو سفارش
          </Button>
        ) : null}
      </div>

      <ul className="mt-6 divide-y divide-border/60">
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
