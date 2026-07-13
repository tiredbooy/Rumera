import { cn } from "@/lib/utils";

import { ORDER_STATUS_FA } from "../labels";
import type { OrderStatus } from "../types";

type Tone = "amber" | "emerald" | "blue" | "destructive" | "muted";

const TONE: Record<Tone, string> = {
  amber:
    "bg-amber-500/10 text-amber-600 ring-amber-500/20 dark:text-amber-400",
  emerald:
    "bg-emerald-500/10 text-emerald-600 ring-emerald-500/20 dark:text-emerald-400",
  blue: "bg-blue-500/10 text-blue-600 ring-blue-500/20 dark:text-blue-400",
  destructive: "bg-destructive/10 text-destructive ring-destructive/20",
  muted: "bg-muted text-muted-foreground ring-border/60",
};

const DOT: Record<Tone, string> = {
  amber: "bg-amber-500",
  emerald: "bg-emerald-500",
  blue: "bg-blue-500",
  destructive: "bg-destructive",
  muted: "bg-muted-foreground/50",
};

const ORDER_TONE: Record<OrderStatus, Tone> = {
  pending: "amber",
  payment_failed: "destructive",
  paid: "emerald",
  processing: "blue",
  ready_to_ship: "blue",
  shipped: "blue",
  out_for_delivery: "blue",
  delivered: "emerald",
  refund_requested: "amber",
  refund_approved: "emerald",
  refunded: "muted",
  partially_refunded: "muted",
  cancelled: "destructive",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const tone = ORDER_TONE[status];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        TONE[tone],
      )}
    >
      <span className={cn("size-1.5 rounded-full", DOT[tone])} aria-hidden />
      {ORDER_STATUS_FA[status]}
    </span>
  );
}
