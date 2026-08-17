"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  parseAsInteger,
  parseAsString,
  parseAsStringEnum,
  useQueryState,
  useQueryStates,
} from "nuqs";

import { GiftCardMine } from "@/features/gift-cards/gift-card-mine";
import { GiftCardPurchase } from "@/features/gift-cards/gift-card-purchase";
import { giftCardKeys } from "@/features/gift-cards/hooks";
import { GiftCardRedeem } from "@/features/wallet/gift-card-redeem";
import { useWallet, useWalletTransactions } from "@/features/wallet/hooks";
import { WalletTopUp } from "@/features/wallet/wallet-topup";
import {
  filterLedgerPage,
  ledgerWindowLabel,
  monthSummaryFromRows,
  WALLET_LEDGER_PAGE_SIZE,
  type WalletTransactionDirection,
} from "../ledger-window";
import { WalletOverview } from "./wallet-overview";
import { WalletTransactions } from "./wallet-transactions";

export function WalletView() {
  const queryClient = useQueryClient();
  const wallet = useWallet();

  // URL-shareable filter + server page (nuqs).
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

  const requestedPage = Math.max(1, page);
  const txs = useWalletTransactions({
    page: requestedPage,
    limit: WALLET_LEDGER_PAGE_SIZE,
  });

  const loaded = React.useMemo(() => txs.data?.results ?? [], [txs.data]);
  const pagination = txs.data?.pagination;
  const transactionsUnavailable = txs.isError && txs.data === undefined;

  // Dir/date are display filters on this server page — not a full-ledger query.
  const filtered = React.useMemo(
    () => filterLedgerPage(loaded, { direction, from, to }),
    [loaded, direction, from, to],
  );

  const monthSummary = React.useMemo(
    () => monthSummaryFromRows(loaded),
    [loaded],
  );

  const totalPages = Math.max(1, pagination?.total_pages ?? 1);
  const safePage = pagination?.page ?? requestedPage;
  const ledgerTotal = pagination?.total_items ?? loaded.length;

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
    setPage(Math.max(1, safePage - 1));
  }

  function showNextPage() {
    setPage(safePage + 1);
  }

  React.useEffect(() => {
    if (!pagination) return;
    if (pagination.total_items > 0 && requestedPage > pagination.total_pages) {
      setPage(pagination.total_pages);
    }
  }, [pagination, requestedPage, setPage]);

  return (
    <>
      <WalletOverview
        balance={Number(wallet.data?.balance ?? 0)}
        creditedThisMonth={monthSummary.credited}
        spentThisMonth={monthSummary.spent}
        summaryWindow={ledgerWindowLabel(pagination)}
        isBalanceLoading={wallet.isLoading}
        isBalanceError={wallet.isError}
        isSummaryLoading={txs.isLoading}
        isSummaryError={transactionsUnavailable}
        onRetryBalance={refetchBalance}
      />

      {/* Gateway top-up + gift purchase — never free money; codes after paid. */}
      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <WalletTopUp
          onSettledRefresh={() => {
            void wallet.refetch();
            void txs.refetch();
          }}
        />
        <GiftCardPurchase
          onSettledRefresh={() => {
            void queryClient.invalidateQueries({ queryKey: giftCardKeys.mine });
          }}
        />
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <GiftCardRedeem />
        <GiftCardMine />
      </div>

      <WalletTransactions
        direction={direction}
        from={from}
        to={to}
        rows={filtered}
        ledgerTotal={ledgerTotal}
        loadedCount={loaded.length}
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
