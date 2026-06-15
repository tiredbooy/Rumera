import Link from "next/link"
import { ArrowLeft, Package } from "lucide-react"

import { faNum, formatPrice } from "@/lib/products"
import { ORDER_STATUS_FA, PAYMENT_FA, faDate } from "@/lib/catalog/labels"
import type { OrderListItem } from "@/lib/catalog/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { OrderStatusStepper } from "./order-status-stepper"

/** Map an order status onto a Badge tone (§5 status colors). */
function statusVariant(status: OrderListItem["status"]) {
  switch (status) {
    case "delivered":
    case "paid":
      return "default" as const
    case "cancelled":
    case "payment_failed":
    case "refunded":
    case "partially_refunded":
      return "destructive" as const
    default:
      return "secondary" as const
  }
}

/**
 * OrderCard — a warm, card-based summary of a single order, used on the account
 * overview and the orders list. Shows the order number, date, payment method,
 * item count and total, with an inline status stepper and a "view details" link.
 */
export function OrderCard({
  order,
  showStepper = true,
}: {
  order: OrderListItem
  showStepper?: boolean
}) {
  return (
    <article className="border-hairline rounded-2xl bg-card p-5 ring-1 ring-foreground/5 transition-colors hover:ring-foreground/10 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Package className="size-5" />
          </span>
          <div className="leading-tight">
            <p className="font-medium">سفارش #{faNum(order.id)}</p>
            <p className="text-xs text-muted-foreground">
              {faDate(order.created_at)} · {PAYMENT_FA[order.payment_method] ?? order.payment_method}
            </p>
          </div>
        </div>
        <Badge variant={statusVariant(order.status)}>
          {ORDER_STATUS_FA[order.status] ?? order.status}
        </Badge>
      </div>

      {showStepper ? (
        <div className="mt-5">
          <OrderStatusStepper status={order.status} />
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap items-end justify-between gap-3 border-t border-border/60 pt-4">
        <div>
          <p className="text-xs text-muted-foreground">{faNum(order.item_count)} قلم</p>
          <p className="mt-0.5 font-serif text-xl text-foil">{formatPrice(order.total_amount)}</p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/account/orders/${order.id}`}>
            جزئیات سفارش <ArrowLeft className="size-4" />
          </Link>
        </Button>
      </div>
    </article>
  )
}
