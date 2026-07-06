"use client";

import * as React from "react";
import {
  useQueryState,
  useQueryStates,
  parseAsStringEnum,
  parseAsString,
  parseAsInteger,
} from "nuqs";
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  RotateCcw,
  ShoppingBag,
  Banknote,
  TrendingUp,
  TrendingDown,
  Clock,
  ChevronRight,
  ChevronLeft,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatPrice, faNum } from "@/lib/products";
import { faDate } from "@/lib/catalog/labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GiftCardRedeem } from "@/features/wallet/gift-card-redeem";
import {
  useWallet,
  useWalletTransactions,
  isCreditTx,
  type WalletTransaction,
} from "@/lib/api/account-hooks";
import { AccountSection } from "../../account/components/account-section";
import { EmptyState } from "../../EmptyState";

// Each ledger type → a label + icon + direction. The four backend types
// collapse into two ledger directions (credit/debit) for colour, but every row
// also carries an explicit icon + Persian label so colour is never the sole
// signal of meaning.
const TYPE_META: Record<string, { label: string; icon: LucideIcon }> = {
  deposit: { label: "افزایش موجودی", icon: ArrowDownLeft },
  refund: { label: "بازگشت وجه", icon: RotateCcw },
  withdraw: { label: "برداشت", icon: ArrowUpRight },
  purchase: { label: "خرید", icon: ShoppingBag },
};

const STATUS_META: Record<
  string,
  { label: string; variant: "secondary" | "outline" | "destructive" }
> = {
  completed: { label: "تکمیل‌شده", variant: "secondary" },
  pending: { label: "در انتظار", variant: "outline" },
  failed: { label: "ناموفق", variant: "destructive" },
  cancelled: { label: "لغوشده", variant: "outline" },
};

const DIRECTION_FILTERS = [
  { value: "all", label: "همه تراکنش‌ها" },
  { value: "credit", label: "واریز (افزایش)" },
  { value: "debit", label: "برداشت / خرید" },
] as const;

const PAGE_SIZE = 8;
// Fetch a generous window so the date-range filter and the month summary stay
// accurate; the ledger is then filtered + paged client-side.
const FETCH_LIMIT = 100;

function typeMeta(type: string) {
  return TYPE_META[type] ?? { label: type, icon: Wallet };
}

/** A read-only ISO date (yyyy-mm-dd) → start/end-of-day millis, or null. */
function dayBound(value: string, end = false): number | null {
  if (!value) return null;
  const d = new Date(`${value}T${end ? "23:59:59.999" : "00:00:00.000"}`);
  const t = d.getTime();
  return Number.isFinite(t) ? t : null;
}

/**
 * TopUpComingSoon — the deliberate replacement for the old TopUpDialog. There is
 * NO self-service deposit endpoint (it was removed as a free-money exploit), so
 * we never POST anywhere here. Instead we surface an honest "gateway top-up
 * coming soon" state and point the customer at the real, working credit path:
 * redeeming a gift card.
 */
function TopUpComingSoon() {
  return (
    <div
      className="border-hairline flex items-center gap-2.5 rounded-2xl bg-card/60 px-4 py-2.5 ring-1 ring-foreground/5"
      data-testid="wallet-topup-comingsoon"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Banknote className="size-4" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium leading-tight">
          شارژ کیف پول از طریق درگاه
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          به‌زودی فعال می‌شود
        </p>
      </div>
      <Badge variant="outline" className="ms-1 shrink-0">
        <Clock className="size-3" aria-hidden /> به‌زودی
      </Badge>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  tone,
  loading,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  tone: "credit" | "debit";
  loading?: boolean;
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

export function WalletView() {
  const wallet = useWallet();
  const txs = useWalletTransactions({ limit: FETCH_LIMIT });

  // URL-shareable filter state (nuqs).
  const [direction, setDirection] = useQueryState(
    "dir",
    parseAsStringEnum(["all", "credit", "debit"]).withDefault("all"),
  );
  const [{ from, to }, setRange] = useQueryStates({
    from: parseAsString.withDefault(""),
    to: parseAsString.withDefault(""),
  });
  const [page, setPage] = useQueryState("page", parseAsInteger.withDefault(1));

  const all = React.useMemo(() => txs.data?.results ?? [], [txs.data]);

  const fromMs = dayBound(from);
  const toMs = dayBound(to, true);

  // Apply direction + date-range filters client-side over the fetched window.
  const filtered = React.useMemo(() => {
    return all.filter((t) => {
      if (direction === "credit" && !isCreditTx(t)) return false;
      if (direction === "debit" && isCreditTx(t)) return false;
      const ts = new Date(t.created_at).getTime();
      if (fromMs !== null && ts < fromMs) return false;
      if (toMs !== null && ts > toMs) return false;
      return true;
    });
  }, [all, direction, fromMs, toMs]);

  // This-month summary (always over the full fetched window, not the filter).
  const monthSummary = React.useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    let credited = 0;
    let spent = 0;
    for (const t of all) {
      if (new Date(t.created_at).getTime() < start) continue;
      if (isCreditTx(t)) credited += t.amount;
      else spent += t.amount;
    }
    return { credited, spent };
  }, [all]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const pageRows = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  const hasActiveFilter = direction !== "all" || from !== "" || to !== "";

  function resetFilters() {
    setDirection("all");
    setRange({ from: "", to: "" });
    setPage(1);
  }

  // Keep the page in range when filters shrink the result set.
  React.useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages, setPage]);

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
            {wallet.isLoading ? (
              <Skeleton className="mt-2 h-12 w-48" />
            ) : wallet.isError ? (
              <div className="mt-2">
                <p className="font-serif text-2xl text-foreground">—</p>
                <button
                  type="button"
                  onClick={() => wallet.refetch()}
                  className="mt-1 cursor-pointer text-sm font-medium text-primary hover:underline"
                >
                  دریافت دوبارهٔ موجودی
                </button>
              </div>
            ) : (
              <p
                className="mt-1 font-serif text-5xl text-foil"
                dir="ltr"
                data-testid="wallet-balance"
              >
                {formatPrice(wallet.data?.balance ?? 0)}
              </p>
            )}
          </div>
          <TopUpComingSoon />
        </div>
      </div>

      {/* This-month summary */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <SummaryCard
          label="واریزی این ماه"
          value={monthSummary.credited}
          icon={TrendingUp}
          tone="credit"
          loading={txs.isLoading}
        />
        <SummaryCard
          label="هزینهٔ این ماه"
          value={monthSummary.spent}
          icon={TrendingDown}
          tone="debit"
          loading={txs.isLoading}
        />
      </div>

      {/* Gift-card redeem — the active, legitimate way to credit the wallet. */}
      <div className="mb-6">
        <GiftCardRedeem />
      </div>

      {/* Transactions */}
      <AccountSection
        title="تراکنش‌ها"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Label htmlFor="wallet-dir" className="sr-only">
              فیلتر نوع تراکنش
            </Label>
            <Select
              value={direction}
              onValueChange={(v) => {
                setDirection(v as typeof direction);
                setPage(1);
              }}
            >
              <SelectTrigger size="sm" className="w-40" id="wallet-dir">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DIRECTION_FILTERS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
        bodyClassName="p-0"
      >
        {/* Date-range filter row */}
        <div className="flex flex-wrap items-end gap-3 border-b border-border/60 px-5 py-4 sm:px-6">
          <div className="flex flex-col gap-1.5">
            <Label
              htmlFor="wallet-from"
              className="text-xs text-muted-foreground"
            >
              از تاریخ
            </Label>
            <Input
              id="wallet-from"
              type="date"
              dir="ltr"
              value={from}
              max={to || undefined}
              onChange={(e) => {
                setRange((s) => ({ ...s, from: e.target.value }));
                setPage(1);
              }}
              className="h-10 w-44 text-start"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label
              htmlFor="wallet-to"
              className="text-xs text-muted-foreground"
            >
              تا تاریخ
            </Label>
            <Input
              id="wallet-to"
              type="date"
              dir="ltr"
              value={to}
              min={from || undefined}
              onChange={(e) => {
                setRange((s) => ({ ...s, to: e.target.value }));
                setPage(1);
              }}
              className="h-10 w-44 text-start"
            />
          </div>
          {hasActiveFilter ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              className="h-10 cursor-pointer text-muted-foreground"
            >
              <X className="size-4" aria-hidden /> پاک کردن فیلترها
            </Button>
          ) : null}
        </div>

        {txs.isLoading ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 rounded-xl" />
            ))}
          </div>
        ) : txs.isError ? (
          <div className="p-6 text-sm text-muted-foreground">
            خطا در دریافت تراکنش‌ها.{" "}
            <button
              type="button"
              onClick={() => txs.refetch()}
              className="cursor-pointer font-medium text-primary hover:underline"
            >
              تلاش دوباره
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title={
              hasActiveFilter
                ? "تراکنشی با این فیلتر یافت نشد"
                : "تراکنشی برای نمایش نیست"
            }
            description={
              hasActiveFilter
                ? "بازهٔ تاریخ یا نوع تراکنش را تغییر دهید."
                : "پس از نخستین تراکنش، تاریخچهٔ کیف پول شما اینجا نمایش داده می‌شود. می‌توانید با کارت هدیه موجودی خود را افزایش دهید."
            }
            className="border-0"
          >
            {hasActiveFilter ? (
              <Button
                variant="outline"
                onClick={resetFilters}
                className="cursor-pointer"
              >
                پاک کردن فیلترها
              </Button>
            ) : null}
          </EmptyState>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-start">نوع</TableHead>
                    <TableHead className="text-start">توضیح</TableHead>
                    <TableHead className="text-start">تاریخ</TableHead>
                    <TableHead className="text-end">مبلغ</TableHead>
                    <TableHead className="text-end">
                      موجودی پس از تراکنش
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageRows.map((t: WalletTransaction) => {
                    const meta = typeMeta(t.type);
                    const Icon = meta.icon;
                    const credit = isCreditTx(t);
                    const status = STATUS_META[t.status];
                    const voided =
                      t.status === "failed" || t.status === "cancelled";
                    return (
                      <TableRow
                        key={t.id}
                        className={cn(voided && "opacity-60")}
                      >
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge
                              variant="secondary"
                              className={cn(
                                "gap-1",
                                credit
                                  ? "bg-emerald-500/12 text-emerald-700 dark:bg-emerald-400/12 dark:text-emerald-300"
                                  : "bg-muted text-muted-foreground",
                              )}
                            >
                              <Icon className="size-3" aria-hidden />{" "}
                              {meta.label}
                            </Badge>
                            {status && t.status !== "completed" ? (
                              <Badge
                                variant={status.variant}
                                className="text-[10px]"
                              >
                                {status.label}
                              </Badge>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[16rem] truncate text-muted-foreground">
                          {t.description ?? "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground whitespace-nowrap">
                          {faDate(t.created_at)}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-end font-medium tabular-nums whitespace-nowrap",
                            credit
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-foreground",
                          )}
                          dir="ltr"
                        >
                          {credit ? "+" : "−"}
                          {formatPrice(t.amount)}
                        </TableCell>
                        <TableCell
                          className="text-end tabular-nums whitespace-nowrap text-muted-foreground"
                          dir="ltr"
                        >
                          {typeof t.balance_after === "number"
                            ? formatPrice(t.balance_after)
                            : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Pager */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 px-5 py-3 sm:px-6">
              <p className="text-xs text-muted-foreground">
                {faNum(filtered.length)} تراکنش
                {totalPages > 1
                  ? ` · صفحهٔ ${faNum(safePage)} از ${faNum(totalPages)}`
                  : ""}
              </p>
              {totalPages > 1 ? (
                <nav
                  className="flex items-center gap-1"
                  aria-label="صفحه‌بندی تراکنش‌ها"
                >
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="cursor-pointer"
                    disabled={safePage <= 1}
                    onClick={() => setPage(safePage - 1)}
                  >
                    <ChevronRight className="size-4" aria-hidden /> قبلی
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="cursor-pointer"
                    disabled={safePage >= totalPages}
                    onClick={() => setPage(safePage + 1)}
                  >
                    بعدی <ChevronLeft className="size-4" aria-hidden />
                  </Button>
                </nav>
              ) : null}
            </div>
          </>
        )}
      </AccountSection>
    </>
  );
}
