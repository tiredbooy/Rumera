"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getWallet,
  listWalletTransactions,
  withdrawFromWallet,
} from "./api";
import { walletKeys } from "./query-keys";
import type { WalletTransactionQuery } from "./types";

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

export function useWithdrawFromWallet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: withdrawFromWallet,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: walletKeys.all }),
  });
}
