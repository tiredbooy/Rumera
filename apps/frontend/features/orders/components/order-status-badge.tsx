import { Badge, type BadgeSemantic } from "@/components/ui/badge";

import { ORDER_STATUS_FA } from "../labels";
import type { OrderStatus } from "../types";

const ORDER_TONE: Record<OrderStatus, BadgeSemantic> = {
  pending: { tone: "warning" },
  payment_failed: { variant: "destructive" },
  paid: { tone: "success" },
  processing: { tone: "info" },
  ready_to_ship: { tone: "info" },
  shipped: { tone: "info" },
  out_for_delivery: { tone: "info" },
  delivered: { tone: "success" },
  refund_requested: { tone: "warning" },
  // Approved but not yet settled — in flight, not a happy ending.
  refund_approved: { tone: "info" },
  // Money left the business: terminal and neutral, never "success".
  refunded: { tone: "neutral" },
  partially_refunded: { tone: "neutral" },
  cancelled: { variant: "destructive" },
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <Badge {...ORDER_TONE[status]} className="gap-1.5 rounded-full">
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {ORDER_STATUS_FA[status]}
    </Badge>
  );
}
