"use client";

import * as React from "react";
import Link from "next/link";
import {
  Loader2,
  Award,
  Gift,
  Sparkles,
  ArrowDownToLine,
  History,
  ShoppingBag,
  Star,
  Cake,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { QueryStateRegion } from "@/components/query-state-region";
import {
  useLoyalty,
  useLoyaltyTransactions,
  useRedeemPoints,
} from "../hooks";
import { newLoyaltyIdempotencyKey } from "../api";
import { loyaltyReasonLabel } from "../reasons";
import type { LoyaltyTier } from "../types";
import { faNum, formatPrice } from "@/lib/products";
import {
  apiErrorMessage,
  apiErrorToast,
} from "@/lib/api/user-facing-error";

// 1 point = this many Toman of wallet credit (matches LOYALTY_REDEEM_VALUE default).
const POINT_VALUE = 1000;

const tierFa: Record<LoyaltyTier, string> = {
  bronze: "برنزی",
  silver: "نقره‌ای",
  gold: "طلایی",
  cellar: "سرداب",
};

export function RewardsView() {
  const loyalty = useLoyalty();
  const transactions = useLoyaltyTransactions();
  const redeem = useRedeemPoints();
  const [amount, setAmount] = React.useState("");
  // One key per redeem intent; refresh only after success so retries share it.
  const idemRef = React.useRef(newLoyaltyIdempotencyKey());

  if (loyalty.isLoading) {
    return (
      <QueryStateRegion
        state="loading"
        aria-label="در حال دریافت اطلاعات باشگاه مشتریان"
        className="border-hairline flex h-48 items-center justify-center rounded-3xl bg-card/60 ring-1 ring-foreground/5"
      >
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </QueryStateRegion>
    );
  }

  if (loyalty.isError || !loyalty.data) {
    const detail = loyalty.error
      ? apiErrorMessage(loyalty.error, "")
      : "";
    return (
      <QueryStateRegion
        state="error"
        className="border-hairline flex min-h-48 flex-col items-center justify-center gap-3 rounded-3xl bg-card/60 p-6 text-center ring-1 ring-foreground/5"
      >
        <p className="text-sm font-medium text-foreground">
          دریافت اطلاعات باشگاه مشتریان ناموفق بود.
        </p>
        {detail ? (
          <p className="max-w-sm text-sm text-muted-foreground">{detail}</p>
        ) : (
          <p className="max-w-sm text-sm text-muted-foreground">
            اتصال را بررسی کنید و دوباره تلاش کنید. امتیازهای شما در سرور محفوظ
            است.
          </p>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void loyalty.refetch()}
        >
          تلاش دوباره
        </Button>
      </QueryStateRegion>
    );
  }

  const data = loyalty.data;
  const txs = transactions.data ?? [];

  const balance = data.points_balance;
  const progress =
    data.next_tier && data.points_to_next > 0
      ? Math.min(
          100,
          Math.round(
            (data.lifetime_points /
              (data.lifetime_points + data.points_to_next)) *
              100,
          ),
        )
      : 100;

  function doRedeem() {
    const points = Number(amount);
    if (!Number.isFinite(points) || points <= 0) {
      toast.error("تعداد امتیاز معتبر وارد کنید");
      return;
    }
    if (points > balance) {
      toast.error("امتیاز کافی ندارید", {
        description: `موجودی شما ${faNum(balance)} امتیاز است.`,
      });
      return;
    }
    redeem.mutate(
      { points, idempotencyKey: idemRef.current },
      {
        onSuccess: () => {
          setAmount("");
          idemRef.current = newLoyaltyIdempotencyKey();
          toast.success("امتیازها به کیف پول شما افزوده شد", {
            description: `${faNum(points)} امتیاز ≈ ${formatPrice(points * POINT_VALUE)}`,
          });
        },
        onError: (e) => {
          const t = apiErrorToast(e, "بازخرید ناموفق بود");
          toast.error(t.title, { description: t.description });
        },
      },
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <div className="flex flex-col gap-6">
        <div className="cellar-glow border-hairline relative overflow-hidden rounded-3xl px-6 py-7 ring-1 ring-foreground/10">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="eyebrow">
                <Sparkles className="size-3.5" /> باشگاه مشتریان
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                امتیاز قابل استفاده
              </p>
              <p className="mt-1 font-serif text-5xl text-foil">
                {faNum(balance)}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                مجموع امتیاز کسب‌شده: {faNum(data.lifetime_points)}
              </p>
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

        {/* How to earn — transparent programme copy (PH-040c) */}
        <div className="border-hairline rounded-3xl bg-card p-6 ring-1 ring-foreground/5">
          <h2 className="font-serif text-2xl">چطور امتیاز بگیرید؟</h2>
          <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
            <li className="flex items-start gap-2.5">
              <ShoppingBag className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>
                پس از <strong className="font-medium text-foreground">پرداخت موفق</strong>{" "}
                سفارش، امتیاز خرید به حساب باشگاه افزوده می‌شود (نه فقط ثبت
                سفارش).
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <Star className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>
                ثبت نظر برای محصولی که{" "}
                <strong className="font-medium text-foreground">خرید تأییدشده</strong>{" "}
                دارید، امتیاز می‌دهد.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <Cake className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>
                با تکمیل تاریخ تولد در پروفایل، هر سال هدیهٔ تولد دریافت می‌کنید.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <Users className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>با دعوت دوستان (کد معرفی) هر دو طرف پاداش می‌گیرید.</span>
            </li>
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/products">مشاهدهٔ محصولات</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/account/settings">ویرایش پروفایل</Link>
            </Button>
          </div>
        </div>

        {/* Redeem */}
        <div className="border-hairline rounded-3xl bg-card p-6 ring-1 ring-foreground/5">
          <h2 className="flex items-center gap-2 font-serif text-2xl">
            <ArrowDownToLine className="size-5 text-primary" /> بازخرید امتیاز
          </h2>
          <p className="mt-1.5 text-base leading-relaxed text-muted-foreground">
            هر امتیاز معادل {formatPrice(POINT_VALUE)} اعتبار کیف پول است.
            بازخرید بلافاصله به کیف پول واریز می‌شود.
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
              <Button
                type="button"
                onClick={doRedeem}
                disabled={redeem.isPending || !amount || balance <= 0}
                className="h-11 cursor-pointer"
              >
                {redeem.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Gift className="size-4" />
                )}
                بازخرید
              </Button>
              {Number(amount) > 0 ? (
                <span className="text-sm font-medium text-foreground">
                  ≈ {formatPrice(Number(amount) * POINT_VALUE)}
                </span>
              ) : null}
            </div>
            {balance <= 0 ? (
              <p className="text-xs text-muted-foreground">
                هنوز امتیازی برای بازخرید ندارید. با خرید یا ثبت نظر شروع کنید.
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {/* History */}
      <div className="border-hairline h-fit rounded-3xl bg-card p-6 ring-1 ring-foreground/5">
        <h2 className="flex items-center gap-2 font-serif text-2xl">
          <History className="size-5 text-primary" /> تاریخچهٔ امتیاز
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          آخرین حرکت‌های باشگاه (کسب و بازخرید)
        </p>
        {transactions.isLoading ? (
          <QueryStateRegion
            state="loading"
            aria-label="در حال دریافت تاریخچهٔ امتیاز"
            className="mt-6 flex min-h-32 items-center justify-center"
          >
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </QueryStateRegion>
        ) : transactions.isError ? (
          <QueryStateRegion
            state="error"
            className="mt-6 flex min-h-32 flex-col items-center justify-center gap-3 text-center"
          >
            <p className="text-sm font-medium">
              دریافت تاریخچهٔ امتیاز ناموفق بود.
            </p>
            {transactions.error ? (
              <p className="max-w-xs text-xs text-muted-foreground">
                {apiErrorMessage(transactions.error, "لطفاً دوباره تلاش کنید.")}
              </p>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void transactions.refetch()}
            >
              تلاش دوباره
            </Button>
          </QueryStateRegion>
        ) : txs.length > 0 ? (
          <ul className="mt-4 divide-y divide-border/60">
            {txs.map((t, i) => (
              <li
                key={`${t.created_at}-${t.reason}-${t.delta}-${i}`}
                className="flex items-center justify-between gap-3 py-3.5 text-sm"
              >
                <div className="min-w-0 text-start">
                  <p className="font-medium">
                    {loyaltyReasonLabel(t.reason)}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {new Date(t.created_at).toLocaleDateString("fa-IR", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 font-serif text-lg tabular-nums",
                    t.delta >= 0 ? "text-emerald-600 dark:text-emerald-500" : "text-muted-foreground",
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
            <p className="text-sm font-medium text-foreground">
              هنوز حرکتی در باشگاه ثبت نشده است
            </p>
            <p className="max-w-xs text-sm text-muted-foreground">
              پس از پرداخت سفارش یا ثبت نظر برای خرید تأییدشده، امتیاز اینجا
              دیده می‌شود.
            </p>
            <Button asChild variant="outline" size="sm" className="mt-1">
              <Link href="/products">شروع خرید</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
