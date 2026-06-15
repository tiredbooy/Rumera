"use client"

import * as React from "react"
import { Loader2, Repeat, Pause, Play, SkipForward, X, Check } from "lucide-react"
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
  active: "bg-emerald-500/15 text-emerald-500",
  paused: "bg-amber-500/15 text-amber-600",
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
        <h2 className="flex items-center gap-2 font-serif text-2xl">
          <Repeat className="size-5 text-primary" /> باکس سرداب
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          هر دوره یک منتخب ویژه برایتان ارسال می‌شود. هر زمان می‌توانید متوقف یا لغو کنید.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {(["monthly", "quarterly"] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCadence(c)}
              className={cn(
                "cursor-pointer rounded-full px-4 py-2 text-sm font-medium transition-colors",
                cadence === c
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-accent"
              )}
            >
              {cadenceFa[c]}
            </button>
          ))}
          <Button onClick={subscribe} disabled={create.isPending} className="h-10 cursor-pointer">
            {create.isPending ? <Loader2 className="animate-spin" /> : <Check className="size-4" />}
            فعال‌سازی اشتراک
          </Button>
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : active.length === 0 ? (
        <p className="text-sm text-muted-foreground">اشتراک فعالی ندارید.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {active.map((s: Subscription) => (
            <div
              key={s.id}
              className="border-hairline flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-card p-5 ring-1 ring-foreground/5"
            >
              <div>
                <p className="flex items-center gap-2 font-serif text-lg">
                  باکس {cadenceFa[s.cadence]}
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", statusTone[s.status])}>
                    {statusFa[s.status]}
                  </span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  ارسال بعدی: {new Date(s.next_renewal_at).toLocaleDateString("fa-IR")}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {s.status === "active" ? (
                  <>
                    <Button variant="outline" size="sm" onClick={() => act(s.id, "skip")} disabled={update.isPending}>
                      <SkipForward className="size-4" /> رد کردن این دوره
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => act(s.id, "pause")} disabled={update.isPending}>
                      <Pause className="size-4" /> توقف
                    </Button>
                  </>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => act(s.id, "resume")} disabled={update.isPending}>
                    <Play className="size-4" /> ازسرگیری
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => act(s.id, "cancel")}
                  disabled={update.isPending}
                  className="text-destructive hover:text-destructive"
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
