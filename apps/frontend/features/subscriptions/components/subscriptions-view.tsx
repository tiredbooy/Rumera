"use client"

import * as React from "react"
import {
  Loader2,
  Repeat,
  Pause,
  Play,
  SkipForward,
  X,
  Check,
  CalendarClock,
  PackageOpen,
  CircleCheck,
  CirclePause,
  CircleSlash,
  MapPin,
  RotateCcw,
} from "lucide-react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { faNum } from "@/lib/products"
import { faDate } from "@/lib/catalog/labels"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  useSubscriptions,
  useCreateSubscription,
  useUpdateSubscription,
  useAddresses,
  type Subscription,
  type SubscriptionAction,
  type SubscriptionStatus,
} from "@/lib/api/hooks"
import type { Address } from "@/lib/catalog/types"

// ── Labels & human copy ──────────────────────────────────────────────────────

const planFa: Record<string, string> = { "cellar-box": "باکس سرداب" }
const planName = (plan: string) => planFa[plan] ?? "باکس دوره‌ای"

/** Human cadence, e.g. «هر ۳۰ روز» / «هر ۳ ماه» — built with Persian digits. */
function cadenceLabel(cadence: Subscription["cadence"]): string {
  return cadence === "quarterly" ? `هر ${faNum(3)} ماه` : `هر ${faNum(30)} روز`
}

/** Short cadence chip, e.g. «دوره ماهانه». */
const cadenceShort: Record<Subscription["cadence"], string> = {
  monthly: "دورهٔ ماهانه",
  quarterly: "دورهٔ فصلی",
}

/**
 * Plain-language status meta: an icon (never color-only), a label, a one-line
 * explanation of what the state means, and the tone used for the banner ring.
 */
const statusMeta: Record<
  SubscriptionStatus,
  { label: string; icon: typeof CircleCheck; explain: string; banner: string; iconClass: string }
> = {
  active: {
    label: "فعال",
    icon: CircleCheck,
    explain: "این اشتراک فعال است؛ باکس بعدی در تاریخ تمدید برایتان ارسال می‌شود.",
    banner: "bg-emerald-500/10 ring-emerald-500/25",
    iconClass: "text-emerald-600 dark:text-emerald-400",
  },
  paused: {
    label: "متوقف‌شده",
    icon: CirclePause,
    explain: "ارسال‌ها موقتاً متوقف شده‌اند. هیچ باکسی ارسال نمی‌شود تا زمانی که از سر بگیرید.",
    banner: "bg-amber-500/10 ring-amber-500/25",
    iconClass: "text-amber-600 dark:text-amber-400",
  },
  cancelled: {
    label: "لغوشده",
    icon: CircleSlash,
    explain: "این اشتراک لغو شده و دیگر باکسی ارسال نمی‌شود. می‌توانید آن را دوباره فعال کنید.",
    banner: "bg-muted ring-foreground/10",
    iconClass: "text-muted-foreground",
  },
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatAddress(addr: Address): string {
  const parts = [addr.state_province, addr.city, addr.address_line1].filter(Boolean)
  return parts.join("، ")
}

type PendingAction = { id: number; action: Extract<SubscriptionAction, "pause" | "cancel"> } | null

// ── View ─────────────────────────────────────────────────────────────────────

export function SubscriptionsView() {
  const { data, isLoading, isError, refetch } = useSubscriptions()
  const { data: addresses } = useAddresses()
  const create = useCreateSubscription()
  const update = useUpdateSubscription()

  const [cadence, setCadence] = React.useState<"monthly" | "quarterly">("monthly")
  const [confirm, setConfirm] = React.useState<PendingAction>(null)
  /** Tracks which subscription row is mid-mutation so we only spin its buttons. */
  const [busyId, setBusyId] = React.useState<number | null>(null)

  const addressById = React.useMemo(() => {
    const map = new Map<number, Address>()
    for (const a of addresses ?? []) map.set(a.id, a)
    return map
  }, [addresses])

  function subscribe() {
    create.mutate(cadence, {
      onSuccess: () => toast.success("اشتراک شما فعال شد"),
      onError: () => toast.error("ایجاد اشتراک ناموفق بود"),
    })
  }

  function run(id: number, action: SubscriptionAction) {
    setBusyId(id)
    update.mutate(
      { id, action },
      {
        onSuccess: () =>
          toast.success(
            action === "cancel"
              ? "اشتراک لغو شد"
              : action === "skip"
                ? "ارسال این دوره به دورهٔ بعد موکول شد"
                : action === "pause"
                  ? "اشتراک متوقف شد"
                  : "اشتراک دوباره فعال شد"
          ),
        onError: () => toast.error("عملیات ناموفق بود"),
        onSettled: () => setBusyId(null),
      }
    )
  }

  const subs = data ?? []
  // Surface everything — including paused & cancelled history.
  const ordered = React.useMemo(() => {
    const rank: Record<SubscriptionStatus, number> = { active: 0, paused: 1, cancelled: 2 }
    return [...subs].sort((a, b) => rank[a.status] - rank[b.status])
  }, [subs])

  return (
    <div className="flex flex-col gap-6">
      {/* ── Create panel ──────────────────────────────────────────────────── */}
      <div className="cellar-glow border-hairline rounded-3xl px-6 py-7 ring-1 ring-foreground/10">
        <p className="eyebrow">
          <Repeat className="size-3.5" /> اشتراک دوره‌ای
        </p>
        <h2 className="mt-2 font-serif text-2xl sm:text-3xl">باکس سرداب</h2>
        <p className="mt-2 max-w-xl text-base leading-relaxed text-muted-foreground">
          در هر دوره یک منتخب ویژه برایتان فرستاده می‌شود. هر زمان خواستید می‌توانید آن را متوقف یا لغو کنید.
        </p>
        <fieldset className="mt-5">
          <legend className="sr-only">انتخاب دورهٔ ارسال</legend>
          <div className="flex flex-wrap items-center gap-2.5">
            {(["monthly", "quarterly"] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCadence(c)}
                aria-pressed={cadence === c}
                className={cn(
                  "inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium ring-1 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  cadence === c
                    ? "bg-primary text-primary-foreground ring-primary"
                    : "bg-secondary text-secondary-foreground ring-transparent hover:bg-accent"
                )}
              >
                {cadenceShort[c]}
                <span className={cn("text-xs", cadence === c ? "text-primary-foreground/80" : "text-muted-foreground")}>
                  · {cadenceLabel(c)}
                </span>
              </button>
            ))}
            <Button onClick={subscribe} disabled={create.isPending} className="h-11 cursor-pointer">
              {create.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Check className="size-4" aria-hidden />
              )}
              فعال‌سازی اشتراک
            </Button>
          </div>
        </fieldset>
      </div>

      {/* ── List ──────────────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex flex-col gap-3" aria-busy="true" aria-label="در حال بارگذاری اشتراک‌ها">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-48 rounded-2xl" />
          ))}
        </div>
      ) : isError ? (
        <div className="border-hairline flex flex-col items-center gap-3 rounded-2xl border-dashed bg-card/40 px-6 py-12 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
            <PackageOpen className="size-6" aria-hidden />
          </span>
          <p className="text-sm text-muted-foreground">خطا در دریافت اشتراک‌ها.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="cursor-pointer">
            <RotateCcw className="size-4" aria-hidden /> تلاش دوباره
          </Button>
        </div>
      ) : ordered.length === 0 ? (
        <div className="border-hairline flex flex-col items-center gap-3 rounded-2xl border-dashed bg-card/50 px-6 py-16 text-center">
          <span className="mb-1 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15">
            <PackageOpen className="size-6" aria-hidden />
          </span>
          <p className="font-serif text-xl leading-tight">هنوز اشتراکی ندارید</p>
          <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
            یک باکس دوره‌ای فعال کنید تا منتخب‌های سرداب به‌طور منظم به دستتان برسد.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-4">
          {ordered.map((s) => (
            <SubscriptionCard
              key={s.id}
              sub={s}
              address={s.address_id ? addressById.get(s.address_id) : undefined}
              busy={busyId === s.id}
              onSkip={() => run(s.id, "skip")}
              onResume={() => run(s.id, "resume")}
              onRequestPause={() => setConfirm({ id: s.id, action: "pause" })}
              onRequestCancel={() => setConfirm({ id: s.id, action: "cancel" })}
            />
          ))}
        </ul>
      )}

      {/* ── Destructive confirmation (pause / cancel) ─────────────────────── */}
      <AlertDialog open={confirm !== null} onOpenChange={(o) => (o ? null : setConfirm(null))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.action === "cancel" ? "لغو اشتراک" : "توقف اشتراک"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.action === "cancel"
                ? "با لغو اشتراک، دیگر هیچ باکسی برایتان ارسال نمی‌شود. هر زمان بخواهید می‌توانید آن را دوباره فعال کنید."
                : "با توقف اشتراک، ارسال‌ها موقتاً متوقف می‌شوند و در این مدت باکسی فرستاده نمی‌شود. هر زمان آماده بودید می‌توانید آن را از سر بگیرید."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">انصراف</AlertDialogCancel>
            <AlertDialogAction
              className={cn(
                "cursor-pointer",
                confirm?.action === "cancel" && "bg-destructive text-white hover:bg-destructive/90"
              )}
              onClick={() => {
                if (!confirm) return
                run(confirm.id, confirm.action)
                setConfirm(null)
              }}
            >
              {confirm?.action === "cancel" ? "بله، لغو شود" : "بله، متوقف شود"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ── Card ─────────────────────────────────────────────────────────────────────

function SubscriptionCard({
  sub,
  address,
  busy,
  onSkip,
  onResume,
  onRequestPause,
  onRequestCancel,
}: {
  sub: Subscription
  address?: Address
  busy: boolean
  onSkip: () => void
  onResume: () => void
  onRequestPause: () => void
  onRequestCancel: () => void
}) {
  const meta = statusMeta[sub.status]
  const StatusIcon = meta.icon
  const cancelled = sub.status === "cancelled"

  return (
    <li className="border-hairline overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/5 shadow-e1">
      <div className="p-5 sm:p-6">
        {/* Header: plan + status pill */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-serif text-xl leading-tight">{planName(sub.plan)}</h3>
            <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              <Repeat className="size-3.5" aria-hidden />
              {cadenceLabel(sub.cadence)}
            </p>
          </div>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset",
              meta.banner
            )}
          >
            <StatusIcon className={cn("size-3.5", meta.iconClass)} aria-hidden />
            {meta.label}
          </span>
        </div>

        {/* Plain-language status banner */}
        <div className={cn("mt-4 flex items-start gap-2.5 rounded-xl px-3.5 py-3 ring-1 ring-inset", meta.banner)}>
          <StatusIcon className={cn("mt-0.5 size-4 shrink-0", meta.iconClass)} aria-hidden />
          <p className="text-sm leading-relaxed text-foreground/80">{meta.explain}</p>
        </div>

        {/* Facts: next renewal + ship-to */}
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="border-hairline rounded-xl bg-background/40 px-3.5 py-3">
            <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarClock className="size-3.5" aria-hidden /> تمدید بعدی
            </dt>
            <dd className={cn("mt-1 text-sm font-medium", cancelled && "text-muted-foreground line-through")}>
              {faDate(sub.next_renewal_at)}
            </dd>
          </div>
          {address ? (
            <div className="border-hairline rounded-xl bg-background/40 px-3.5 py-3">
              <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin className="size-3.5" aria-hidden /> ارسال به
              </dt>
              <dd className="mt-1 truncate text-sm font-medium" title={formatAddress(address)}>
                {address.title || address.full_name}
                <span className="font-normal text-muted-foreground"> — {formatAddress(address)}</span>
              </dd>
            </div>
          ) : null}
        </dl>

        {/* Actions */}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          {sub.status === "active" ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={onSkip}
                disabled={busy}
                className="cursor-pointer"
              >
                {busy ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <SkipForward className="size-4" aria-hidden />
                )}
                رد کردن این دوره
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onRequestPause}
                disabled={busy}
                className="cursor-pointer"
              >
                <Pause className="size-4" aria-hidden /> توقف موقت
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onRequestCancel}
                disabled={busy}
                className="cursor-pointer text-destructive hover:text-destructive"
              >
                <X className="size-4" aria-hidden /> لغو اشتراک
              </Button>
            </>
          ) : sub.status === "paused" ? (
            <>
              <Button size="sm" onClick={onResume} disabled={busy} className="cursor-pointer">
                {busy ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Play className="size-4" aria-hidden />
                )}
                از سر گرفتن
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onRequestCancel}
                disabled={busy}
                className="cursor-pointer text-destructive hover:text-destructive"
              >
                <X className="size-4" aria-hidden /> لغو اشتراک
              </Button>
            </>
          ) : (
            // cancelled → reactivate (the `resume` action restores it to active)
            <Button size="sm" onClick={onResume} disabled={busy} className="cursor-pointer">
              {busy ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <RotateCcw className="size-4" aria-hidden />
              )}
              فعال‌سازی مجدد
            </Button>
          )}
        </div>
      </div>
    </li>
  )
}
