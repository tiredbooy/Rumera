"use client"

import * as React from "react"
import { Loader2, Award, Gift, Sparkles, ArrowDownToLine, History } from "lucide-react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import {
  useLoyalty,
  useLoyaltyTransactions,
  useRedeemPoints,
  type LoyaltyTx,
} from "@/lib/api/hooks"
import { faNum, formatPrice } from "@/lib/products"
import { ApiClientError } from "@/lib/api/store-client"

// 1 point = this many Toman of wallet credit (matches LOYALTY_REDEEM_VALUE default).
const POINT_VALUE = 1000

const tierFa: Record<string, string> = {
  bronze: "برنزی",
  silver: "نقره‌ای",
  gold: "طلایی",
  cellar: "سرداب",
}
const reasonFa: Record<string, string> = {
  order_paid: "امتیاز خرید",
  signup: "هدیهٔ عضویت",
  redeem: "بازخرید امتیاز",
  redeem_reversal: "بازگشت امتیاز",
}

export function RewardsView() {
  const { data, isLoading } = useLoyalty()
  const { data: txs } = useLoyaltyTransactions()
  const redeem = useRedeemPoints()
  const [amount, setAmount] = React.useState("")

  if (isLoading || !data) {
    return (
      <div className="border-hairline flex h-48 items-center justify-center rounded-3xl bg-card/60 ring-1 ring-foreground/5">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const balance = data.points_balance
  const progress =
    data.next_tier && data.points_to_next > 0
      ? Math.min(100, Math.round((data.lifetime_points / (data.lifetime_points + data.points_to_next)) * 100))
      : 100

  function doRedeem() {
    const points = Number(amount)
    if (!Number.isFinite(points) || points <= 0) return
    if (points > balance) {
      toast.error("امتیاز کافی ندارید")
      return
    }
    redeem.mutate(points, {
      onSuccess: () => {
        setAmount("")
        toast.success("امتیازها به کیف پول شما افزوده شد")
      },
      onError: (e) =>
        toast.error(
          e instanceof ApiClientError && e.code === "INSUFFICIENT_FUNDS"
            ? "امتیاز کافی ندارید"
            : "بازخرید ناموفق بود"
        ),
    })
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      {/* Balance + tier */}
      <div className="flex flex-col gap-6">
        <div className="cellar-glow border-hairline relative overflow-hidden rounded-3xl px-6 py-7 ring-1 ring-foreground/10">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="eyebrow">
                <Sparkles className="size-3.5" /> باشگاه مشتریان
              </p>
              <p className="mt-2 text-sm text-muted-foreground">امتیاز قابل استفاده</p>
              <p className="mt-1 font-serif text-5xl text-foil">{faNum(balance)}</p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1.5 text-sm font-medium text-primary ring-1 ring-primary/20">
              <Award className="size-4" /> سطح {tierFa[data.tier] ?? data.tier}
            </span>
          </div>

          {data.next_tier ? (
            <div className="mt-7">
              <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>تا سطح {tierFa[data.next_tier] ?? data.next_tier}</span>
                <span>{faNum(data.points_to_next)} امتیاز دیگر</span>
              </div>
              <Progress
                value={progress}
                aria-label={`پیشرفت تا سطح ${tierFa[data.next_tier] ?? data.next_tier}`}
              />
            </div>
          ) : (
            <p className="mt-7 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
              <Sparkles className="size-4" /> به بالاترین سطح رسیده‌اید
            </p>
          )}
        </div>

        {/* Redeem */}
        <div className="border-hairline rounded-3xl bg-card p-6 ring-1 ring-foreground/5">
          <h2 className="flex items-center gap-2 font-serif text-2xl">
            <ArrowDownToLine className="size-5 text-primary" /> بازخرید امتیاز
          </h2>
          <p className="mt-1.5 text-base leading-relaxed text-muted-foreground">
            هر امتیاز معادل {formatPrice(POINT_VALUE)} اعتبار کیف پول است.
          </p>
          <div className="mt-5 flex flex-col gap-2">
            <Label htmlFor="redeem-amount">تعداد امتیاز برای بازخرید</Label>
            <div className="flex flex-wrap items-center gap-3">
              <Input
                id="redeem-amount"
                type="number"
                inputMode="numeric"
                min={1}
                max={balance}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="تعداد امتیاز"
                dir="ltr"
                className="h-11 max-w-[160px] text-start"
              />
              <Button onClick={doRedeem} disabled={redeem.isPending || !amount} className="h-11 cursor-pointer">
                {redeem.isPending ? <Loader2 className="size-4 animate-spin" /> : <Gift className="size-4" />}
                بازخرید
              </Button>
              {Number(amount) > 0 ? (
                <span className="text-sm font-medium text-foreground">
                  ≈ {formatPrice(Number(amount) * POINT_VALUE)}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* History */}
      <div className="border-hairline h-fit rounded-3xl bg-card p-6 ring-1 ring-foreground/5">
        <h2 className="flex items-center gap-2 font-serif text-2xl">
          <History className="size-5 text-primary" /> تاریخچهٔ امتیاز
        </h2>
        {txs && txs.length > 0 ? (
          <ul className="mt-4 divide-y divide-border/60">
            {txs.map((t: LoyaltyTx, i) => (
              <li key={i} className="flex items-center justify-between gap-3 py-3.5 text-sm">
                <div>
                  <p className="font-medium">{reasonFa[t.reason] ?? t.reason}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {new Date(t.created_at).toLocaleDateString("fa-IR")}
                  </p>
                </div>
                <span
                  className={cn(
                    "font-serif text-lg tabular-nums",
                    t.delta >= 0 ? "text-emerald-500" : "text-muted-foreground"
                  )}
                  dir="ltr"
                >
                  {t.delta >= 0 ? "+" : "−"}
                  {faNum(Math.abs(t.delta))}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-6 flex flex-col items-center gap-3 py-8 text-center">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <History className="size-5" />
            </div>
            <p className="text-sm text-muted-foreground">هنوز امتیازی ثبت نشده است.</p>
          </div>
        )}
      </div>
    </div>
  )
}
