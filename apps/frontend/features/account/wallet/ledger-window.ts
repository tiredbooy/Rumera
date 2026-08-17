import { faNum } from "@/lib/products";
import type { Pagination } from "@/lib/api/types";
import {
  isCreditTransaction,
  type WalletTransaction,
} from "@/features/wallet/types";

/** Matches BE default `limit` (`models.BaseFilter`, max 100). */
export const WALLET_LEDGER_PAGE_SIZE = 20;

export type WalletTransactionDirection = "all" | "credit" | "debit";

/** A read-only ISO date (yyyy-mm-dd) → start/end-of-day millis, or null. */
export function dayBound(value: string, end = false): number | null {
  if (!value) return null;
  const d = new Date(`${value}T${end ? "23:59:59.999" : "00:00:00.000"}`);
  const t = d.getTime();
  return Number.isFinite(t) ? t : null;
}

/** Client dir/date apply only to the loaded server page, not the full ledger. */
export function filterLedgerPage(
  rows: readonly WalletTransaction[],
  opts: {
    direction: WalletTransactionDirection;
    from: string;
    to: string;
  },
): WalletTransaction[] {
  const fromMs = dayBound(opts.from);
  const toMs = dayBound(opts.to, true);
  return rows.filter((transaction) => {
    if (opts.direction === "credit" && !isCreditTransaction(transaction)) {
      return false;
    }
    if (opts.direction === "debit" && isCreditTransaction(transaction)) {
      return false;
    }
    const ts = new Date(transaction.created_at).getTime();
    if (fromMs !== null && ts < fromMs) return false;
    if (toMs !== null && ts > toMs) return false;
    return true;
  });
}

export function monthSummaryFromRows(
  rows: readonly WalletTransaction[],
  now: Date = new Date(),
): { credited: number; spent: number } {
  const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  let credited = 0;
  let spent = 0;
  for (const transaction of rows) {
    if (new Date(transaction.created_at).getTime() < start) continue;
    if (isCreditTransaction(transaction)) credited += Number(transaction.amount);
    else spent += Number(transaction.amount);
  }
  return { credited, spent };
}

export function isPartialLedgerWindow(
  pagination:
    | Pick<Pagination, "page" | "limit" | "total_items" | "total_pages">
    | undefined,
): boolean {
  if (!pagination) return false;
  return (
    pagination.total_pages > 1 ||
    pagination.page > 1 ||
    pagination.total_items > pagination.limit
  );
}

/** Qualifier so month KPIs are not read as a complete calendar-month total. */
export function ledgerWindowLabel(
  pagination: Pick<Pagination, "page" | "total_pages"> | undefined,
): string {
  if (pagination && pagination.total_pages > 1) {
    return `صفحهٔ ${faNum(pagination.page)} از ${faNum(pagination.total_pages)}`;
  }
  return "این صفحه";
}

/** Pager caption: server total, or filtered count of the loaded page. */
export function ledgerCountLabel(opts: {
  hasActiveFilter: boolean;
  rowCount: number;
  loadedCount: number;
  ledgerTotal: number;
  safePage: number;
  totalPages: number;
}): string {
  const pageSuffix =
    opts.totalPages > 1
      ? ` · صفحهٔ ${faNum(opts.safePage)} از ${faNum(opts.totalPages)}`
      : "";
  if (opts.hasActiveFilter) {
    return `${faNum(opts.rowCount)} از ${faNum(opts.loadedCount)} تراکنش این صفحه${pageSuffix}`;
  }
  return `${faNum(opts.ledgerTotal)} تراکنش${pageSuffix}`;
}
