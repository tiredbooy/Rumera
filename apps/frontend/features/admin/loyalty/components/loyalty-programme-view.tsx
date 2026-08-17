import Link from "next/link";
import {
  Award,
  Cake,
  Info,
  Lock,
  ShoppingBag,
  Star,
  Users,
  Wallet,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { faNum, formatPrice } from "@/lib/products";

import { loyaltyTierLabel } from "../labels";
import type { LoyaltyProgramme } from "../types";
import { LoyaltyProgrammeForm } from "./loyalty-programme-form";

export function LoyaltyProgrammeView({
  programme,
  canWrite = false,
}: {
  programme: LoyaltyProgramme;
  /** customers:write — the same capability the backend requires for the PUT. */
  canWrite?: boolean;
}) {
  const rates = [
    {
      icon: ShoppingBag,
      label: "امتیاز خرید",
      value: `هر ${faNum(programme.earn_divisor)} تومان = ۱ امتیاز`,
      hint: "مبلغ خرید لازم برای هر امتیاز",
    },
    {
      icon: Wallet,
      label: "بازخرید به کیف پول",
      value: `هر امتیاز ≈ ${formatPrice(programme.redeem_value)}`,
      hint: "ارزش هر امتیاز هنگام بازخرید",
    },
    {
      icon: Award,
      label: "هدیهٔ عضویت",
      value: `${faNum(programme.signup_bonus)} امتیاز`,
      hint: "یک‌بار، هنگام عضویت",
    },
    {
      icon: Star,
      label: "نظر خرید تأییدشده",
      value: `${faNum(programme.review_bonus)} امتیاز`,
      hint: "برای هر نظر تأییدشده",
    },
    {
      icon: Cake,
      label: "هدیهٔ تولد",
      value: `${faNum(programme.birthday_bonus)} امتیاز / سال`,
      hint: `سالانه · منطقهٔ زمانی ${programme.birthday_tz}`,
    },
    {
      icon: Users,
      label: "پاداش معرفی",
      value: `${faNum(programme.referral_reward)} امتیاز برای هر طرف`,
      hint: "برای هر طرف معرفی",
    },
  ];

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="gap-1.5">
          <Lock className="size-3.5" />
          {programme.editable ? "قابل ویرایش" : "فقط‌خواندنی"}
        </Badge>
        <Badge variant="outline">منبع: {programme.config_source}</Badge>
      </div>

      {!programme.editable ? (
        <div className="border-hairline mb-6 flex gap-3 rounded-2xl bg-muted/40 p-4 text-sm text-muted-foreground ring-1 ring-foreground/5">
          <Info className="mt-0.5 size-4 shrink-0 text-primary" />
          <div className="space-y-1">
            <p className="font-medium text-foreground">
              این استقرار هنوز ردیف برنامه را ندارد
            </p>
            <p>
              مقادیر زیر از متغیرهای محیطی خوانده شده‌اند و تا ساخته‌شدن ردیف
              برنامه قابل ویرایش نیستند.
            </p>
            <p className="text-xs">{programme.runbook}</p>
          </div>
        </div>
      ) : canWrite ? (
        <LoyaltyProgrammeForm programme={programme} />
      ) : (
        <div className="border-hairline mb-6 flex gap-3 rounded-2xl bg-muted/40 p-4 text-sm text-muted-foreground ring-1 ring-foreground/5">
          <Info className="mt-0.5 size-4 shrink-0 text-primary" />
          <p>ویرایش برنامه به دسترسی «customers:write» نیاز دارد.</p>
        </div>
      )}

      <section className="mb-8">
        <h2 className="mb-3 font-serif text-xl">نرخ‌های مؤثر</h2>
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rates.map((row) => {
            const Icon = row.icon;
            return (
              <li
                key={row.hint}
                className="border-hairline rounded-2xl bg-card p-4 ring-1 ring-foreground/5"
              >
                <p className="flex items-center gap-2 text-sm font-medium">
                  <Icon className="size-4 text-primary" />
                  {row.label}
                </p>
                <p className="mt-2 text-base text-foreground">{row.value}</p>
                <p className="mt-1 font-mono text-[0.7rem] text-muted-foreground">
                  {row.hint}
                </p>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 font-serif text-xl">سطوح (بر اساس lifetime)</h2>
        <div className="border-hairline overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/5">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-start font-medium">سطح</th>
                <th className="px-4 py-2.5 text-start font-medium">
                  حداقل امتیاز lifetime
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {programme.tiers.map((t) => (
                <tr key={t.id}>
                  <td className="px-4 py-2.5 font-medium">
                    {loyaltyTierLabel(t.id)}
                    <span className="ms-2 font-mono text-xs text-muted-foreground">
                      {t.id}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 tabular-nums" dir="ltr">
                    {faNum(t.min_lifetime_points)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/customers">مشتریان</Link>
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/gift-cards">کارت هدیه</Link>
        </Button>
      </div>
    </>
  );
}
