"use client"

import * as React from "react"
import { Loader2, Repeat, Pause, Play, SkipForward, X, Check, CalendarClock, PackageOpen } from "lucide-react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  useSubscriptions,
  useCreateSubscription,
  useUpdateSubscription,
  type Subscription,
} from "@/lib/api/hooks"

const cadenceFa: Record<string, string> = { monthly: "ماهانه", quarterly: "فصلی" }
const statusFa: Record<string, string> = {
  active: "فعال",
  paused: "متوقف",
  cancelled: "لغوشده",
}
const statusTone: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  paused: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  cancelled: "bg-muted text-muted-foreground",
}

export function SubscriptionsView() {
  const { data, isLoading } = useSubscriptions()
  const create = useCreateSubscription()
  const update = useUpdateSubscription()
  const [cadence, setCadence] = React.useState<"monthly" | "quarterly">("monthly")

  function subscribe() {
    create.mutate(cadence, {
      onSuccess: () => toast.success("اشتراک شما فعال شد"),
      onError: () => toast.error("ایجاد اشتراک ناموفق بود"),
    })
  }

  function act(id: number, action: "pause" | "resume" | "cancel" | "skip") {
    update.mutate(
      { id, action },
      {
        onSuccess: () =>
          toast.success(
            action === "cancel"
              ? "اشتراک لغو شد"
              : action === "skip"
                ? "ارسال بعدی یک دوره به تعویق افتاد"
                : "اشتراک به‌روزرسانی شد"
          ),
        onError: () => toast.error("عملیات ناموفق بود"),
      }
    )
  }

  const subs = data ?? []
  const active = subs.filter((s) => s.status !== "cancelled")

  return (
    <div className="flex flex-col gap-6">
      {/* Create */}
      <div className="cellar-glow border-hairline rounded-3xl px-6 py-7 ring-1 ring-foreground/10">
        <p className="eyebrow">
          <Repeat className="size-3.5" /> اشتراک دوره‌ای
        </p>
        <h2 className="mt-2 font-serif text-2xl sm:text-3xl">باکس سرداب</h2>
        <p className="mt-2 max-w-xl text-base leading-relaxed text-muted-foreground">
          هر دوره یک منتخب ویژه برایتان ارسال می‌شود. هر زمان می‌توانید متوقف یا لغو کنید.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-2.5">
          {(["monthly", "quarterly"] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCadence(c)}
              aria-pressed={cadence === c}
              className={cn(
                "inline-flex min-h-11 cursor-pointer items-center rounded-full px-4 py-2 text-sm font-medium ring-1 transition-colors duration-200",
                cadence === c
                  ? "bg-primary text-primary-foreground ring-primary"
                  : "bg-secondary text-secondary-foreground ring-transparent hover:bg-accent"
              )}
            >
              {cadenceFa[c]}
            </button>
          ))}
          <Button onClick={subscribe} disabled={create.isPending} className="h-11 cursor-pointer">
            {create.isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            فعال‌سازی اشتراک
          </Button>
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="border-hairline flex h-32 items-center justify-center rounded-3xl bg-card/60 ring-1 ring-foreground/5">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : active.length === 0 ? (
        <div className="border-hairline flex flex-col items-center gap-3 rounded-3xl bg-card/60 px-6 py-12 text-center ring-1 ring-foreground/5">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <PackageOpen className="size-6" />
          </div>
          <p className="font-serif text-xl">اشتراک فعالی ندارید</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            یک باکس دوره‌ای فعال کنید تا منتخب‌های سرداب به‌طور منظم به دستتان برسد.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {active.map((s: Subscription) => (
            <div
              key={s.id}
              className="border-hairline flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-card p-5 ring-1 ring-foreground/5"
            >
              <div>
                <p className="flex flex-wrap items-center gap-2 font-serif text-lg">
                  باکس {cadenceFa[s.cadence]}
                  <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", statusTone[s.status])}>
                    {statusFa[s.status]}
                  </span>
                </p>
                <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarClock className="size-3.5" />
                  ارسال بعدی: {new Date(s.next_renewal_at).toLocaleDateString("fa-IR")}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {s.status === "active" ? (
                  <>
                    <Button variant="outline" size="sm" onClick={() => act(s.id, "skip")} disabled={update.isPending} className="cursor-pointer">
                      <SkipForward className="size-4" /> رد کردن این دوره
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => act(s.id, "pause")} disabled={update.isPending} className="cursor-pointer">
                      <Pause className="size-4" /> توقف
                    </Button>
                  </>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => act(s.id, "resume")} disabled={update.isPending} className="cursor-pointer">
                    <Play className="size-4" /> ازسرگیری
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => act(s.id, "cancel")}
                  disabled={update.isPending}
                  className="cursor-pointer text-destructive hover:text-destructive"
                >
                  <X className="size-4" /> لغو
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
