import { TrendingDown, TrendingUp, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/products";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryStateRegion } from "@/components/query-state-region";

type WalletOverviewProps = {
  balance: number;
  creditedThisMonth: number;
  spentThisMonth: number;
  isBalanceLoading: boolean;
  isBalanceError: boolean;
  isSummaryLoading: boolean;
  isSummaryError: boolean;
  onRetryBalance: () => void;
};

function SummaryCard({
  label,
  value,
  icon: Icon,
  tone,
  loading,
  error,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  tone: "credit" | "debit";
  loading: boolean;
  error: boolean;
}) {
  return (
    <div className="border-hairline rounded-2xl bg-card p-4 ring-1 ring-foreground/5">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon
          className={cn(
            "size-3.5",
            tone === "credit"
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-muted-foreground",
          )}
          aria-hidden
        />
        {label}
      </p>
      {loading ? (
        <Skeleton className="mt-2 h-7 w-28" />
      ) : error ? (
        <p className="mt-1.5 text-sm font-medium text-muted-foreground">
          در دسترس نیست
        </p>
      ) : (
        <p
          className={cn(
            "mt-1.5 text-lg font-semibold tabular-nums",
            tone === "credit"
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-foreground",
          )}
          dir="ltr"
        >
          {tone === "credit" ? "+" : "−"}
          {formatPrice(value)}
        </p>
      )}
    </div>
  );
}

export function WalletOverview({
  balance,
  creditedThisMonth,
  spentThisMonth,
  isBalanceLoading,
  isBalanceError,
  isSummaryLoading,
  isSummaryError,
  onRetryBalance,
}: WalletOverviewProps) {
  return (
    <>
      {/* Balance hero */}
      <div className="cellar-glow border-hairline mb-6 overflow-hidden rounded-3xl px-6 py-7 ring-1 ring-foreground/10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">
              <Wallet className="size-3.5" /> کیف پول رومرا
            </p>
            <p className="mt-2 text-sm text-muted-foreground">موجودی فعلی</p>
            {isBalanceLoading ? (
              <QueryStateRegion
                state="loading"
                aria-label="در حال دریافت موجودی کیف پول"
                className="mt-2"
              >
                <Skeleton className="h-12 w-48" />
              </QueryStateRegion>
            ) : isBalanceError ? (
              <QueryStateRegion state="error" className="mt-2">
                <p className="font-serif text-2xl text-foreground">—</p>
                <button
                  type="button"
                  onClick={onRetryBalance}
                  className="mt-1 cursor-pointer text-sm font-medium text-primary hover:underline"
                >
                  دریافت دوبارهٔ موجودی
                </button>
              </QueryStateRegion>
            ) : (
              <p
                className="mt-1 font-serif text-5xl text-foil"
                dir="ltr"
                data-testid="wallet-balance"
              >
                {formatPrice(balance)}
              </p>
            )}
          </div>
          <p className="max-w-xs text-end text-xs text-muted-foreground">
            شارژ از درگاه و کارت هدیه — بدون واریز رایگان
          </p>
        </div>
      </div>

      {/* This-month summary */}
      <QueryStateRegion
        state={
          isSummaryLoading ? "loading" : isSummaryError ? "error" : undefined
        }
        aria-label={
          isSummaryLoading
            ? "در حال دریافت خلاصهٔ تراکنش‌های این ماه"
            : undefined
        }
        className="mb-6 grid gap-3 sm:grid-cols-2"
      >
        <SummaryCard
          label="واریزی این ماه"
          value={creditedThisMonth}
          icon={TrendingUp}
          tone="credit"
          loading={isSummaryLoading}
          error={isSummaryError}
        />
        <SummaryCard
          label="هزینهٔ این ماه"
          value={spentThisMonth}
          icon={TrendingDown}
          tone="debit"
          loading={isSummaryLoading}
          error={isSummaryError}
        />
      </QueryStateRegion>
    </>
  );
}
