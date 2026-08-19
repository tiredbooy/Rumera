import "server-only";

import { Suspense, type ReactNode } from "react";
import { Cake, Coins, Layers } from "lucide-react";

import { Badge, type BadgeSemantic } from "@/components/ui/badge";
import { AdminDataErrorState } from "@/features/dashboard/components/admin-data-error-state";
import { faNum, formatPrice } from "@/lib/products";
import { faDateTime } from "@/lib/utils/date";

import { getLoyaltyOverview } from "../api/server";
import { loyaltyTierLabel } from "../labels";
import type {
  LoyaltyBirthdayHealth,
  LoyaltyOverview,
  LoyaltyTierDistribution,
} from "../types";

const BIRTHDAY_STATUS: Record<
  string,
  { label: string; semantic: BadgeSemantic; hint: string }
> = {
  ok: {
    label: "به‌روز",
    semantic: { tone: "success" },
    hint: "همهٔ متولدهای امروز هدیهٔ امسال را گرفته‌اند.",
  },
  pending: {
    label: "عقب‌افتاده",
    semantic: { tone: "warning" },
    hint: "متولدهایی در امروز مانده‌اند که هدیهٔ امسالشان ثبت نشده است.",
  },
  idle: {
    label: "بدون مورد",
    semantic: { tone: "neutral" },
    hint: "امروز کسی متولد نشده است؛ کاری برای این اجرا وجود نداشت.",
  },
  off: {
    label: "خاموش",
    semantic: { variant: "destructive" },
    hint: "برنامه یا هدیهٔ تولد خاموش است و کرون چیزی اهدا نمی‌کند.",
  },
};

/**
 * L-9: the programme-level operational view — points liability, tier
 * distribution and birthday-job health.
 *
 * Self-fetching behind its own boundary for the same reason as the customer
 * widget: the rates screen must render whether or not this read lands.
 */
export function LoyaltyOverviewPanel() {
  return (
    <Suspense fallback={<LoyaltyOverviewSkeleton />}>
      <LoyaltyOverviewCards />
    </Suspense>
  );
}

/** The streamed half: everything that has to await the overview read. */
export async function LoyaltyOverviewCards() {
  let overview: LoyaltyOverview;
  try {
    overview = await getLoyaltyOverview();
  } catch {
    return (
      <OverviewSection>
        <AdminDataErrorState
          title="بارگذاری وضعیت عملیاتی ناموفق بود"
          description="بدهی امتیازی، توزیع سطوح و سلامت هدیهٔ تولد دریافت نشد. نرخ‌های زیر همچنان معتبرند."
        />
      </OverviewSection>
    );
  }

  return (
    <OverviewSection>
      <div className="grid gap-3 lg:grid-cols-3">
        <LiabilityCard overview={overview} />
        <TierCard tiers={overview.tiers} members={overview.members} />
        <BirthdayCard health={overview.birthday} />
      </div>
    </OverviewSection>
  );
}

function OverviewSection({ children }: { children: ReactNode }) {
  return (
    <section className="mb-8" aria-labelledby="loyalty-overview-title">
      <h2 id="loyalty-overview-title" className="mb-3 font-serif text-xl">
        وضعیت عملیاتی
      </h2>
      {children}
    </section>
  );
}

function LiabilityCard({ overview }: { overview: LoyaltyOverview }) {
  return (
    <article
      className="border-hairline rounded-2xl bg-card p-4 ring-1 ring-foreground/5"
      data-testid="loyalty-liability-card"
    >
      <p className="flex items-center gap-2 text-sm font-medium">
        <Coins className="size-4 text-primary" aria-hidden />
        بدهی امتیازی
      </p>
      {/* Exact decimal from the API — formatPrice groups the string, never
          rounds it through a float (lib/money.ts). */}
      <p
        className="mt-2 font-serif text-2xl text-foil tabular-nums"
        data-testid="loyalty-liability-amount"
      >
        {formatPrice(overview.points_liability)}
      </p>
      <dl className="mt-3 grid gap-1 text-xs text-muted-foreground">
        <div className="flex justify-between gap-2">
          <dt>امتیاز خرج‌نشده</dt>
          <dd className="tabular-nums text-foreground" dir="ltr">
            {faNum(overview.points_outstanding)}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>ارزش هر امتیاز</dt>
          <dd className="tabular-nums text-foreground">
            {formatPrice(overview.redeem_value)}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>اعضا</dt>
          <dd className="tabular-nums text-foreground" dir="ltr">
            {faNum(overview.members)}
          </dd>
        </div>
      </dl>
      {!overview.enabled ? (
        <p className="mt-3 text-xs text-muted-foreground">
          برنامه خاموش است، اما این امتیازها همچنان بدهی‌اند و روزی بازخرید
          می‌شوند.
        </p>
      ) : null}
    </article>
  );
}

function TierCard({
  tiers,
  members,
}: {
  tiers: LoyaltyTierDistribution[];
  members: number;
}) {
  return (
    <article
      className="border-hairline rounded-2xl bg-card p-4 ring-1 ring-foreground/5"
      data-testid="loyalty-tier-distribution"
    >
      <p className="flex items-center gap-2 text-sm font-medium">
        <Layers className="size-4 text-primary" aria-hidden />
        توزیع سطوح
      </p>
      {tiers.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          هنوز عضوی در باشگاه نیست.
        </p>
      ) : (
        <ul className="mt-3 grid gap-2">
          {tiers.map((tier) => {
            const share = members > 0 ? (tier.members / members) * 100 : 0;
            return (
              <li key={tier.tier}>
                <div className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="font-medium text-foreground">
                    {loyaltyTierLabel(tier.tier)}
                  </span>
                  <span
                    className="text-muted-foreground tabular-nums"
                    dir="ltr"
                  >
                    {faNum(tier.members)} · {faNum(Math.round(share))}٪
                  </span>
                </div>
                <div
                  className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"
                  role="presentation"
                >
                  <div
                    className="h-full rounded-full bg-primary/70"
                    style={{ width: `${share}%` }}
                  />
                </div>
                <p className="mt-1 text-[0.7rem] text-muted-foreground tabular-nums">
                  {faNum(tier.points_balance)} امتیاز خرج‌نشده
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </article>
  );
}

function BirthdayCard({ health }: { health: LoyaltyBirthdayHealth }) {
  const status = BIRTHDAY_STATUS[health.status] ?? BIRTHDAY_STATUS.idle;
  return (
    <article
      className="border-hairline rounded-2xl bg-card p-4 ring-1 ring-foreground/5"
      data-testid="loyalty-birthday-health"
    >
      <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
        <Cake className="size-4 text-primary" aria-hidden />
        هدیهٔ تولد
        <Badge {...status.semantic} className="rounded-full">
          {status.label}
        </Badge>
      </p>
      <dl className="mt-3 grid gap-1 text-xs text-muted-foreground">
        <div className="flex justify-between gap-2">
          <dt>امروز ({health.local_date})</dt>
          <dd className="tabular-nums text-foreground" dir="ltr">
            {faNum(health.granted_today)}/{faNum(health.due_today)}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>مانده از امروز</dt>
          <dd className="tabular-nums text-foreground" dir="ltr">
            {faNum(health.pending_today)}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>اهدا در امسال</dt>
          <dd className="tabular-nums text-foreground" dir="ltr">
            {faNum(health.granted_this_year)}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>آخرین اهدا</dt>
          <dd className="tabular-nums text-foreground">
            {health.last_award_at ? faDateTime(health.last_award_at) : "هرگز"}
          </dd>
        </div>
      </dl>
      <p className="mt-3 text-xs text-muted-foreground">{status.hint}</p>
      <p className="mt-1 text-[0.7rem] text-muted-foreground">
        منطقهٔ زمانی {health.timezone} · {faNum(health.bonus)} امتیاز در سال
      </p>
    </article>
  );
}

function LoyaltyOverviewSkeleton() {
  return (
    <section className="mb-8" aria-hidden>
      <div className="mb-3 h-6 w-32 animate-pulse rounded bg-muted" />
      <div className="grid gap-3 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="border-hairline h-44 animate-pulse rounded-2xl bg-muted/40 ring-1 ring-foreground/5"
          />
        ))}
      </div>
    </section>
  );
}
