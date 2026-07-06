import Link from "next/link";
import { ArrowLeft, Package } from "lucide-react";

import { cn } from "@/lib/utils";
import { faNum, formatPrice } from "@/lib/products";
import { ORDER_STATUS_FA, PAYMENT_FA, faDate } from "@/lib/catalog/labels";
import type { OrderListItem } from "@/lib/catalog/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { OrderStatusStepper } from "./OrderStatusStepper";

/** Map an order status onto a Badge tone (§5 status colors). */
function statusVariant(status: OrderListItem["status"]) {
  switch (status) {
    case "delivered":
    case "paid":
      return "default" as const;
    case "cancelled":
    case "payment_failed":
    case "refunded":
    case "partially_refunded":
      return "destructive" as const;
    default:
      return "secondary" as const;
  }
}

/** Tone the order-number medallion to echo the order's lifecycle stage. */
function iconTone(status: OrderListItem["status"]) {
  switch (status) {
    case "delivered":
      return "bg-primary/12 text-primary ring-primary/15";
    case "cancelled":
    case "payment_failed":
    case "refunded":
    case "partially_refunded":
      return "bg-destructive/10 text-destructive ring-destructive/15";
    default:
      return "bg-wine/10 text-wine ring-wine/15";
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
  order: OrderListItem;
  showStepper?: boolean;
}) {
  return (
    <article className="group/order border-hairline relative flex flex-col overflow-hidden rounded-2xl bg-card p-5 ring-1 ring-foreground/5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-foreground/5 hover:ring-primary/20 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "flex size-11 shrink-0 items-center justify-center rounded-2xl ring-1 transition-colors",
              iconTone(order.status),
            )}
          >
            <Package className="size-5" />
          </span>
          <div className="leading-tight">
            <p className="font-serif text-lg leading-tight transition-colors group-hover/order:text-primary">
              سفارش #{faNum(order.id)}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {faDate(order.created_at)} ·{" "}
              {PAYMENT_FA[order.payment_method] ?? order.payment_method}
            </p>
          </div>
        </div>
        <Badge variant={statusVariant(order.status)}>
          {ORDER_STATUS_FA[order.status] ?? order.status}
        </Badge>
      </div>

      {showStepper ? (
        <div className="mt-6">
          <OrderStatusStepper status={order.status} />
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap items-end justify-between gap-3 border-t border-border/60 pt-4">
        <div>
          <p className="eyebrow text-[11px]">{faNum(order.item_count)} قلم</p>
          <p className="mt-0.5 font-serif text-2xl text-foil">
            {formatPrice(order.total_amount)}
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/account/orders/${order.id}`}>
            جزئیات سفارش{" "}
            <ArrowLeft className="size-4 transition-transform group-hover/order:-translate-x-0.5" />
          </Link>
        </Button>
      </div>
    </article>
  );
}
