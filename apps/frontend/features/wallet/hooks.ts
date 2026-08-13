"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createWalletTopUp,
  getWallet,
  listWalletTransactions,
  withdrawFromWallet,
} from "./api";
import { walletKeys } from "./query-keys";
import type { WalletTopUpInput, WalletTransactionQuery } from "./types";

export function useWallet(enabled = true) {
  return useQuery({
    queryKey: walletKeys.all,
    queryFn: getWallet,
    enabled,
  });
}

export function useWalletTransactions(
  query: WalletTransactionQuery = {},
  enabled = true,
) {
  return useQuery({
    queryKey: walletKeys.transactions(query),
    queryFn: () => listWalletTransactions(query),
    enabled,
    placeholderData: (previous) => previous,
  });
}

/** Gateway top-up intent. Does not credit balance until webhook settles. */
export function useWalletTopUp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: WalletTopUpInput & { idempotencyKey?: string }) =>
      createWalletTopUp(
        { amount: input.amount },
        input.idempotencyKey,
      ),
    onSuccess: () => {
      // Pending intent only — still refresh ledger in case a prior payment settled.
      queryClient.invalidateQueries({ queryKey: walletKeys.all });
      queryClient.invalidateQueries({ queryKey: ["wallet", "transactions"] });
    },
  });
}

/** @deprecated 410 Gone — not used by storefront. */
export function useWithdrawFromWallet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: withdrawFromWallet,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: walletKeys.all }),
  });
}
