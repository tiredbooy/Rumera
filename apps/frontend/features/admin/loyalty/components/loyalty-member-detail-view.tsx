import "server-only";

import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Award, Coins, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AdminDataErrorState } from "@/features/dashboard/components/admin-data-error-state";
import { PageHeader } from "@/features/dashboard/components/page-header";
import { ApiError } from "@/lib/api/errors";
import { faNum } from "@/lib/products";
import { faDateTime } from "@/lib/utils/date";

import { getLoyaltyMember } from "../api/server";
import { requireLoyaltyEnabled } from "../guard";
import { loyaltyTierLabel, memberDisplayName } from "../labels";
import type { LoyaltyMemberAccount } from "../types";
import { LoyaltyAdjustForm } from "./loyalty-adjust-form";
import {
  LoyaltyLedgerSkeleton,
  LoyaltyMemberLedger,
} from "./loyalty-member-ledger";

export async function LoyaltyMemberDetailView({
  userID,
  ledgerPage,
  ledgerReason,
  canAdjust = false,
}: {
  userID: string;
  ledgerPage: number;
  ledgerReason?: string;
  /** loyalty:adjust — grant / clawback affordance (L-8, not customers:write) */
  canAdjust?: boolean;
}) {
  await requireLoyaltyEnabled();

  let member: LoyaltyMemberAccount;
  try {
    member = await getLoyaltyMember(userID);
  } catch (error) {
    if (
      error instanceof ApiError &&
      (error.status === 400 || error.status === 404 || error.status === 422)
    ) {
      notFound();
    }
    if (
      error instanceof ApiError &&
      (error.status === 401 || error.status === 403)
    ) {
      throw error;
    }
    return (
      <>
        <PageHeader
          eyebrow={
            <nav
              className="flex items-center gap-1.5 text-xs text-muted-foreground"
              aria-label="مسیر"
            >
              <Link
                href="/admin/loyalty"
                className="transition-colors hover:text-foreground"
              >
                باشگاه مشتریان
              </Link>
              <span aria-hidden>/</span>
              <span className="text-foreground">عضو</span>
            </nav>
          }
          title="عضو باشگاه"
          actions={
            <Button
              variant="outline"
              size="sm"
              asChild
              className="h-11 cursor-pointer"
            >
              <Link href="/admin/loyalty">
                <ArrowRight className="size-4" aria-hidden /> بازگشت
              </Link>
            </Button>
          }
        />
        <AdminDataErrorState
          title="بارگذاری حساب عضو ناموفق بود"
          description="موجودی و سطح از سرور دریافت نشد. اتصال را بررسی کنید و دوباره تلاش کنید."
        />
      </>
    );
  }

  const displayName = memberDisplayName(member);

  return (
    <>
      <PageHeader
        eyebrow={
          <nav
            className="flex items-center gap-1.5 text-xs text-muted-foreground"
            aria-label="مسیر"
          >
            <Link
              href="/admin/loyalty"
              className="transition-colors hover:text-foreground"
            >
              باشگاه مشتریان
            </Link>
            <span aria-hidden>/</span>
            <span className="break-all text-foreground">{displayName}</span>
          </nav>
        }
        title={displayName}
        description={member.email}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" asChild className="h-11 cursor-pointer">
              <Link href={`/admin/customers/${member.user_id}`}>
                <UserRound className="size-4" aria-hidden /> پروندهٔ مشتری
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              asChild
              className="h-11 cursor-pointer"
            >
              <Link href="/admin/loyalty">
                <ArrowRight className="size-4" aria-hidden /> بازگشت
              </Link>
            </Button>
          </div>
        }
      />

      <div className="border-hairline rounded-2xl bg-card p-5 ring-1 ring-foreground/[0.04]">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
          <span
            className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/15 font-serif text-xl text-primary"
            aria-hidden
          >
            {displayName.trim().charAt(0).toUpperCase()}
          </span>
          <dl className="grid flex-1 grid-cols-2 gap-x-6 gap-y-4 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-xs text-muted-foreground">موجودی امتیاز</dt>
              <dd className="mt-1 font-medium tabular-nums" dir="ltr">
                {faNum(member.points_balance)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">امتیاز lifetime</dt>
              <dd className="mt-1 font-medium tabular-nums" dir="ltr">
                {faNum(member.lifetime_points)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">سطح</dt>
              <dd className="mt-1 font-medium">
                {loyaltyTierLabel(member.tier)}
                <span className="ms-2 font-mono text-xs text-muted-foreground">
                  {member.tier}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">سطح بعدی</dt>
              <dd className="mt-1 font-medium">
                {member.next_tier ? (
                  <>
                    {loyaltyTierLabel(member.next_tier)}
                    <span className="ms-2 text-xs text-muted-foreground tabular-nums">
                      {faNum(member.points_to_next)} امتیاز مانده
                    </span>
                  </>
                ) : (
                  "بالاترین سطح"
                )}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs text-muted-foreground">شناسهٔ کاربر</dt>
              <dd
                className="mt-1 truncate font-mono text-xs"
                dir="ltr"
                title={member.user_id}
              >
                {member.user_id}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">به‌روزرسانی</dt>
              <dd className="mt-1 font-medium tabular-nums">
                {faDateTime(member.updated_at)}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="mt-6">
        {canAdjust ? (
          <LoyaltyAdjustForm
            userId={member.user_id}
            userLabel={displayName}
            canAdjust
          />
        ) : (
          <div className="border-hairline rounded-2xl bg-muted/30 p-5 text-sm text-muted-foreground ring-1 ring-foreground/[0.04]">
            <p className="flex items-center gap-2 font-medium text-foreground">
              <Award className="size-4 text-primary" aria-hidden />
              تنظیم امتیاز
            </p>
            <p className="mt-1">
              برای اهدا یا برگشت امتیاز به مجوز «تنظیم امتیاز باشگاه» نیاز است.
            </p>
          </div>
        )}
      </div>

      <Suspense
        key={`${ledgerReason ?? "all"}|${ledgerPage}`}
        fallback={
          <section className="mt-6" aria-labelledby="loyalty-ledger-title">
            <h2
              id="loyalty-ledger-title"
              className="mb-3 flex items-center gap-2 font-serif text-lg"
            >
              <Coins className="size-4.5 text-primary" aria-hidden />
              دفتر کل امتیاز
            </h2>
            <LoyaltyLedgerSkeleton />
          </section>
        }
      >
        <LoyaltyMemberLedger
          userID={member.user_id}
          page={ledgerPage}
          reason={ledgerReason}
        />
      </Suspense>
    </>
  );
}