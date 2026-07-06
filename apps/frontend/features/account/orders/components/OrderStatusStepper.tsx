import { Check, Clock, CreditCard, PackageOpen, Truck, Home, XCircle } from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import type { OrderStatus } from "@/lib/catalog/types"

/**
 * OrderStatusStepper — the customer-facing fulfilment timeline:
 *   ثبت‌شده → پرداخت → آماده‌سازی → ارسال → تحویل
 * Maps the backend's fine-grained `OrderStatus` onto five reassuring milestones.
 * Cancelled / refunded orders short-circuit to a single destructive state.
 * Renders horizontally (default) or vertically (`orientation="vertical"`) for the
 * order-detail timeline.
 */

type Step = { key: string; label: string; icon: LucideIcon }

const STEPS: Step[] = [
  { key: "placed", label: "ثبت‌شده", icon: Clock },
  { key: "paid", label: "پرداخت", icon: CreditCard },
  { key: "processing", label: "آماده‌سازی", icon: PackageOpen },
  { key: "shipped", label: "ارسال", icon: Truck },
  { key: "delivered", label: "تحویل", icon: Home },
]

/** Which milestone (0-indexed) a given status has reached. */
function stepIndex(status: OrderStatus): number {
  switch (status) {
    case "pending":
    case "payment_failed":
      return 0
    case "paid":
      return 1
    case "processing":
    case "ready_to_ship":
      return 2
    case "shipped":
    case "out_for_delivery":
      return 3
    case "delivered":
      return 4
    // Refund states sit past delivery — treat the journey as complete.
    case "refund_requested":
    case "refund_approved":
    case "refunded":
    case "partially_refunded":
      return 4
    default:
      return 0
  }
}

export function OrderStatusStepper({
  status,
  orientation = "horizontal",
  className,
}: {
  status: OrderStatus
  orientation?: "horizontal" | "vertical"
  className?: string
}) {
  if (status === "cancelled") {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-2 rounded-full bg-destructive/10 px-3 py-1.5 text-sm font-medium text-destructive",
          className
        )}
      >
        <XCircle className="size-4" /> سفارش لغو شد
      </div>
    )
  }

  const active = stepIndex(status)

  if (orientation === "vertical") {
    return (
      <ol className={cn("relative space-y-0", className)}>
        {STEPS.map((step, i) => {
          const done = i < active
          const current = i === active
          const Icon = done ? Check : step.icon
          return (
            <li key={step.key} className="flex gap-3 pb-6 last:pb-0">
              <div className="relative flex flex-col items-center">
                <span
                  className={cn(
                    "flex size-8 items-center justify-center rounded-full transition-colors",
                    done
                      ? "bg-primary text-primary-foreground"
                      : current
                        ? "bg-primary text-primary-foreground ring-4 ring-primary/15"
                        : "bg-secondary text-muted-foreground"
                  )}
                >
                  <Icon className="size-4" />
                </span>
                {i < STEPS.length - 1 ? (
                  <span
                    className={cn(
                      "mt-1 w-px flex-1 transition-colors",
                      done ? "bg-primary" : "bg-border"
                    )}
                  />
                ) : null}
              </div>
              <div className="pt-1">
                <p
                  className={cn(
                    "text-sm transition-colors",
                    current
                      ? "font-medium text-foreground"
                      : done
                        ? "text-foreground/80"
                        : "text-muted-foreground"
                  )}
                >
                  {step.label}
                </p>
              </div>
            </li>
          )
        })}
      </ol>
    )
  }

  return (
    <ol className={cn("flex items-center", className)} aria-label="وضعیت سفارش">
      {STEPS.map((step, i) => {
        const done = i < active
        const current = i === active
        const Icon = done ? Check : step.icon
        return (
          <li key={step.key} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <span
                className={cn(
                  "flex size-8 items-center justify-center rounded-full transition-colors",
                  done
                    ? "bg-primary text-primary-foreground"
                    : current
                      ? "bg-primary text-primary-foreground ring-4 ring-primary/15"
                      : "bg-secondary text-muted-foreground"
                )}
              >
                <Icon className="size-4" />
              </span>
              <span
                className={cn(
                  "text-[11px] whitespace-nowrap",
                  current ? "font-medium text-foreground" : "text-muted-foreground"
                )}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 ? (
              <span
                className={cn(
                  "mx-1 mb-5 h-px flex-1 transition-colors",
                  i < active ? "bg-primary" : "bg-border"
                )}
              />
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}
