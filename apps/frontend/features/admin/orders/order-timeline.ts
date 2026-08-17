import { ORDER_STATUS_FA } from "@/features/orders/labels";
import type { OrderStatus } from "@/features/orders/types";

import type { AdminOrder } from "./types";

export type OrderTimelineEvent = {
  key: string;
  label: string;
  at?: string;
  current: boolean;
};

export function buildOrderTimeline(order: AdminOrder): OrderTimelineEvent[] {
  const events: OrderTimelineEvent[] = [
    { key: "created", label: "ثبت سفارش", at: order.created_at, current: false },
  ];

  if (order.paid_at) {
    events.push({
      key: "paid",
      label: ORDER_STATUS_FA.paid,
      at: order.paid_at,
      current: false,
    });
  }
  if (order.shipped_at) {
    events.push({
      key: "shipped",
      label: ORDER_STATUS_FA.shipped,
      at: order.shipped_at,
      current: false,
    });
  }
  if (order.delivered_at) {
    events.push({
      key: "delivered",
      label: ORDER_STATUS_FA.delivered,
      at: order.delivered_at,
      current: false,
    });
  }
  if (order.cancelled_at) {
    events.push({
      key: "cancelled",
      label: ORDER_STATUS_FA.cancelled,
      at: order.cancelled_at,
      current: false,
    });
  }

  const represented = new Set(events.map((event) => event.key));
  const currentKey = statusTimelineKey(order.status);
  if (currentKey && !represented.has(currentKey)) {
    events.push({
      key: currentKey,
      label: ORDER_STATUS_FA[order.status],
      current: true,
    });
  }

  const last = events[events.length - 1];
  if (last) last.current = true;
  return events;
}

function statusTimelineKey(status: OrderStatus): string | null {
  switch (status) {
    case "paid":
      return "paid";
    case "shipped":
    case "out_for_delivery":
      return "shipped";
    case "delivered":
      return "delivered";
    case "cancelled":
      return "cancelled";
    case "pending":
    case "payment_failed":
    case "processing":
    case "ready_to_ship":
    case "refund_requested":
    case "refund_approved":
    case "refunded":
    case "partially_refunded":
      return status;
    default:
      return null;
  }
}
