import { cn } from "@/lib/utils"
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
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  destructive: "bg-destructive/10 text-destructive",
  muted: "bg-muted text-muted-foreground",
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
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
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
