import { CheckCircle2, Ban } from "lucide-react"

import { cn } from "@/lib/utils"
import { ROLE_LABELS, type Role } from "@/lib/rbac/roles"
import { ORDER_STATUS_FA } from "@/lib/catalog/labels"
import type { OrderStatus } from "@/lib/catalog/types"
import type {
  PaymentStatus,
  FulfilmentStatus,
  StockStatus,
  ReviewStatus,
  RecipeStatus,
  CustomerStatus,
} from "@/lib/admin/data"

/**
 * Status pills for the admin tables. One tiny dot + label per status, with a
 * single colour vocabulary reused everywhere (amber = waiting, emerald = good,
 * blue = in-transit, destructive = bad, muted = neutral/draft). Presentational
 * and server-renderable — no Badge dependency so the dot colour is exact.
 */

type Tone = "amber" | "emerald" | "blue" | "destructive" | "muted"

const TONE: Record<Tone, string> = {
  amber: "bg-amber-500/10 text-amber-600 ring-amber-500/20 dark:text-amber-400",
  emerald: "bg-emerald-500/10 text-emerald-600 ring-emerald-500/20 dark:text-emerald-400",
  blue: "bg-blue-500/10 text-blue-600 ring-blue-500/20 dark:text-blue-400",
  destructive: "bg-destructive/10 text-destructive ring-destructive/20",
  muted: "bg-muted text-muted-foreground ring-border/60",
}

const DOT: Record<Tone, string> = {
  amber: "bg-amber-500",
  emerald: "bg-emerald-500",
  blue: "bg-blue-500",
  destructive: "bg-destructive",
  muted: "bg-muted-foreground/50",
}

function Pill({ tone, label }: { tone: Tone; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        TONE[tone]
      )}
    >
      <span className={cn("size-1.5 rounded-full", DOT[tone])} />
      {label}
    </span>
  )
}

const PAYMENT: Record<PaymentStatus, { tone: Tone; label: string }> = {
  paid: { tone: "emerald", label: "پرداخت‌شده" },
  pending: { tone: "amber", label: "در انتظار پرداخت" },
  refunded: { tone: "muted", label: "بازپرداخت‌شده" },
  failed: { tone: "destructive", label: "ناموفق" },
}

const FULFILMENT: Record<FulfilmentStatus, { tone: Tone; label: string }> = {
  processing: { tone: "amber", label: "در حال پردازش" },
  packed: { tone: "blue", label: "بسته‌بندی" },
  shipped: { tone: "blue", label: "ارسال‌شده" },
  delivered: { tone: "emerald", label: "تحویل‌شده" },
  cancelled: { tone: "destructive", label: "لغوشده" },
}

const STOCK: Record<StockStatus, { tone: Tone; label: string }> = {
  in_stock: { tone: "emerald", label: "موجود" },
  low: { tone: "amber", label: "رو به اتمام" },
  out: { tone: "destructive", label: "ناموجود" },
}

const REVIEW: Record<ReviewStatus, { tone: Tone; label: string }> = {
  pending: { tone: "amber", label: "در انتظار بازبینی" },
  approved: { tone: "emerald", label: "تأییدشده" },
  rejected: { tone: "destructive", label: "ردشده" },
}

const RECIPE: Record<RecipeStatus, { tone: Tone; label: string }> = {
  published: { tone: "emerald", label: "منتشرشده" },
  draft: { tone: "muted", label: "پیش‌نویس" },
}

const CUSTOMER: Record<CustomerStatus, { tone: Tone; label: string }> = {
  active: { tone: "emerald", label: "فعال" },
  banned: { tone: "destructive", label: "مسدود" },
}

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  return <Pill {...PAYMENT[status]} />
}
export function FulfilmentBadge({ status }: { status: FulfilmentStatus }) {
  return <Pill {...FULFILMENT[status]} />
}
export function StockBadge({ status }: { status: StockStatus }) {
  return <Pill {...STOCK[status]} />
}
export function ReviewBadge({ status }: { status: ReviewStatus }) {
  return <Pill {...REVIEW[status]} />
}
export function RecipeBadge({ status }: { status: RecipeStatus }) {
  return <Pill {...RECIPE[status]} />
}
export function CustomerBadge({ status }: { status: CustomerStatus }) {
  return <Pill {...CUSTOMER[status]} />
}

// Tones for the backend's 13-value order lifecycle (labels from ORDER_STATUS_FA).
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
}

/** Single status pill for a live backend order (`status` from GET /admin/orders). */
export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Pill tone={ORDER_TONE[status] ?? "muted"} label={ORDER_STATUS_FA[status] ?? status} />
}

/**
 * Active/inactive badge for a backend user account. Carries an icon AND a label
 * (not colour alone) so the state is legible to colour-blind users and screen
 * readers — `is_active` from `GET /admin/users`.
 */
export function UserStatusBadge({ active }: { active: boolean }) {
  const tone: Tone = active ? "emerald" : "muted"
  const Icon = active ? CheckCircle2 : Ban
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        TONE[tone]
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {active ? "فعال" : "غیرفعال"}
    </span>
  )
}

/** Persian role pill (`ROLE_LABELS`) for the admin users list/detail. */
export function UserRoleBadge({ role }: { role: Role }) {
  return (
    <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary ring-1 ring-inset ring-primary/15">
      {ROLE_LABELS[role]}
    </span>
  )
}
