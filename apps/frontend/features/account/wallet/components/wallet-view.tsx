"use client";

import * as React from "react";
import {
  parseAsInteger,
  parseAsString,
  parseAsStringEnum,
  useQueryState,
  useQueryStates,
} from "nuqs";

import { GiftCardRedeem } from "@/features/wallet/gift-card-redeem";
import { useWallet, useWalletTransactions } from "@/features/wallet/hooks";
import { isCreditTransaction } from "@/features/wallet/types";
import { WalletOverview } from "./wallet-overview";
import {
  WalletTransactions,
  type WalletTransactionDirection,
} from "./wallet-transactions";

const PAGE_SIZE = 8;
// Fetch a generous window so the date-range filter and the month summary stay
// accurate; the ledger is then filtered + paged client-side.
const FETCH_LIMIT = 100;

/** A read-only ISO date (yyyy-mm-dd) → start/end-of-day millis, or null. */
function dayBound(value: string, end = false): number | null {
  if (!value) return null;
  const d = new Date(`${value}T${end ? "23:59:59.999" : "00:00:00.000"}`);
  const t = d.getTime();
  return Number.isFinite(t) ? t : null;
}

export function WalletView() {
  const wallet = useWallet();
  const txs = useWalletTransactions({ limit: FETCH_LIMIT });

  // URL-shareable filter state (nuqs).
  const [direction, setDirection] = useQueryState(
    "dir",
    parseAsStringEnum<WalletTransactionDirection>([
      "all",
      "credit",
      "debit",
    ]).withDefault("all"),
  );
  const [{ from, to }, setRange] = useQueryStates({
    from: parseAsString.withDefault(""),
    to: parseAsString.withDefault(""),
  });
  const [page, setPage] = useQueryState("page", parseAsInteger.withDefault(1));

  const all = React.useMemo(() => txs.data?.results ?? [], [txs.data]);
  const transactionsUnavailable = txs.isError && txs.data === undefined;

  const fromMs = dayBound(from);
  const toMs = dayBound(to, true);

  // Apply direction + date-range filters client-side over the fetched window.
  const filtered = React.useMemo(() => {
    return all.filter((t) => {
      if (direction === "credit" && !isCreditTransaction(t)) return false;
      if (direction === "debit" && isCreditTransaction(t)) return false;
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
      if (isCreditTransaction(t)) credited += Number(t.amount);
      else spent += Number(t.amount);
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

  function changeDirection(nextDirection: WalletTransactionDirection) {
    setDirection(nextDirection);
    setPage(1);
  }

  function changeFrom(nextFrom: string) {
    setRange((state) => ({ ...state, from: nextFrom }));
    setPage(1);
  }

  function changeTo(nextTo: string) {
    setRange((state) => ({ ...state, to: nextTo }));
    setPage(1);
  }

  function refetchBalance() {
    wallet.refetch();
  }

  function refetchTransactions() {
    txs.refetch();
  }

  function showPreviousPage() {
    setPage(safePage - 1);
  }

  function showNextPage() {
    setPage(safePage + 1);
  }

  // Keep the page in range when filters shrink the result set.
  React.useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages, setPage]);

  return (
    <>
      <WalletOverview
        balance={Number(wallet.data?.balance ?? 0)}
        creditedThisMonth={monthSummary.credited}
        spentThisMonth={monthSummary.spent}
        isBalanceLoading={wallet.isLoading}
        isBalanceError={wallet.isError}
        isSummaryLoading={txs.isLoading}
        isSummaryError={transactionsUnavailable}
        onRetryBalance={refetchBalance}
      />

      {/* Gift-card redeem — the active, legitimate way to credit the wallet. */}
      <div className="mb-6">
        <GiftCardRedeem />
      </div>

      <WalletTransactions
        direction={direction}
        from={from}
        to={to}
        rows={pageRows}
        transactionCount={filtered.length}
        totalPages={totalPages}
        safePage={safePage}
        hasActiveFilter={hasActiveFilter}
        isLoading={txs.isLoading}
        isError={transactionsUnavailable}
        onDirectionChange={changeDirection}
        onFromChange={changeFrom}
        onToChange={changeTo}
        onResetFilters={resetFilters}
        onRetry={refetchTransactions}
        onPreviousPage={showPreviousPage}
        onNextPage={showNextPage}
      />
    </>
  );
}
