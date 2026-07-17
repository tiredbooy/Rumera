import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  ShoppingBag,
  Wallet,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { faNum, formatPrice } from "@/lib/products";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryStateRegion } from "@/components/query-state-region";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  isCreditTransaction,
  type WalletTransaction,
  type WalletTransactionStatus,
  type WalletTransactionType,
} from "@/features/wallet/types";
import { AccountSection } from "../../account/components/account-section";
import { EmptyState } from "../../EmptyState";

export type WalletTransactionDirection = "all" | "credit" | "debit";

// Each ledger type has an explicit icon and Persian label so colour is never
// the sole signal of meaning.
const TYPE_META: Record<
  WalletTransactionType,
  { label: string; icon: LucideIcon }
> = {
  deposit: { label: "افزایش موجودی", icon: ArrowDownLeft },
  refund: { label: "بازگشت وجه", icon: RotateCcw },
  withdraw: { label: "برداشت", icon: ArrowUpRight },
  purchase: { label: "خرید", icon: ShoppingBag },
};

const STATUS_META: Record<
  WalletTransactionStatus,
  { label: string; variant: "secondary" | "outline" | "destructive" }
> = {
  completed: { label: "تکمیل‌شده", variant: "secondary" },
  pending: { label: "در انتظار", variant: "outline" },
  failed: { label: "ناموفق", variant: "destructive" },
  cancelled: { label: "لغوشده", variant: "outline" },
};

const DIRECTION_FILTERS: ReadonlyArray<{
  value: WalletTransactionDirection;
  label: string;
}> = [
  { value: "all", label: "همه تراکنش‌ها" },
  { value: "credit", label: "واریز (افزایش)" },
  { value: "debit", label: "برداشت / خرید" },
];

const faDateFormatter = new Intl.DateTimeFormat("fa-IR", {
  dateStyle: "medium",
});

function faDate(iso: string): string {
  try {
    return faDateFormatter.format(new Date(iso));
  } catch {
    return iso;
  }
}

type WalletTransactionsProps = {
  direction: WalletTransactionDirection;
  from: string;
  to: string;
  rows: WalletTransaction[];
  transactionCount: number;
  totalPages: number;
  safePage: number;
  hasActiveFilter: boolean;
  isLoading: boolean;
  isError: boolean;
  onDirectionChange: (direction: WalletTransactionDirection) => void;
  onFromChange: (from: string) => void;
  onToChange: (to: string) => void;
  onResetFilters: () => void;
  onRetry: () => void;
  onPreviousPage: () => void;
  onNextPage: () => void;
};

export function WalletTransactions({
  direction,
  from,
  to,
  rows,
  transactionCount,
  totalPages,
  safePage,
  hasActiveFilter,
  isLoading,
  isError,
  onDirectionChange,
  onFromChange,
  onToChange,
  onResetFilters,
  onRetry,
  onPreviousPage,
  onNextPage,
}: WalletTransactionsProps) {
  return (
    <AccountSection
      title="تراکنش‌ها"
      action={
        <div className="flex flex-wrap items-center gap-2">
          <Label htmlFor="wallet-dir" className="sr-only">
            فیلتر نوع تراکنش
          </Label>
          <Select
            value={direction}
            onValueChange={(value) =>
              onDirectionChange(value as WalletTransactionDirection)
            }
          >
            <SelectTrigger size="sm" className="w-40" id="wallet-dir">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DIRECTION_FILTERS.map((filter) => (
                <SelectItem key={filter.value} value={filter.value}>
                  {filter.label}
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
            onChange={(event) => onFromChange(event.target.value)}
            className="h-10 w-44 text-start"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="wallet-to" className="text-xs text-muted-foreground">
            تا تاریخ
          </Label>
          <Input
            id="wallet-to"
            type="date"
            dir="ltr"
            value={to}
            min={from || undefined}
            onChange={(event) => onToChange(event.target.value)}
            className="h-10 w-44 text-start"
          />
        </div>
        {hasActiveFilter ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onResetFilters}
            className="h-10 cursor-pointer text-muted-foreground"
          >
            <X className="size-4" aria-hidden /> پاک کردن فیلترها
          </Button>
        ) : null}
      </div>

      {isLoading ? (
        <QueryStateRegion
          state="loading"
          aria-label="در حال دریافت تراکنش‌های کیف پول"
          className="space-y-2 p-5"
        >
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-12 rounded-xl" />
          ))}
        </QueryStateRegion>
      ) : isError ? (
        <QueryStateRegion
          state="error"
          className="p-6 text-sm text-muted-foreground"
        >
          خطا در دریافت تراکنش‌ها.{" "}
          <button
            type="button"
            onClick={onRetry}
            className="cursor-pointer font-medium text-primary hover:underline"
          >
            تلاش دوباره
          </button>
        </QueryStateRegion>
      ) : transactionCount === 0 ? (
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
              onClick={onResetFilters}
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
                {rows.map((transaction) => {
                  const meta = TYPE_META[transaction.type];
                  const Icon = meta.icon;
                  const credit = isCreditTransaction(transaction);
                  const status = STATUS_META[transaction.status];
                  const voided =
                    transaction.status === "failed" ||
                    transaction.status === "cancelled";

                  return (
                    <TableRow
                      key={transaction.id}
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
                            <Icon className="size-3" aria-hidden /> {meta.label}
                          </Badge>
                          {transaction.status !== "completed" ? (
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
                        {transaction.description ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        {faDate(transaction.created_at)}
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
                        {formatPrice(Number(transaction.amount))}
                      </TableCell>
                      <TableCell
                        className="text-end tabular-nums whitespace-nowrap text-muted-foreground"
                        dir="ltr"
                      >
                        {transaction.balance_after !== undefined
                          ? formatPrice(Number(transaction.balance_after))
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
              {faNum(transactionCount)} تراکنش
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
                  onClick={onPreviousPage}
                >
                  <ChevronRight className="size-4" aria-hidden /> قبلی
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="cursor-pointer"
                  disabled={safePage >= totalPages}
                  onClick={onNextPage}
                >
                  بعدی <ChevronLeft className="size-4" aria-hidden />
                </Button>
              </nav>
            ) : null}
          </div>
        </>
      )}
    </AccountSection>
  );
}
