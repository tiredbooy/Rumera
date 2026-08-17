"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { walletKeys } from "@/features/wallet/query-keys";

import {
  getLoyaltyAccount,
  listLoyaltyTransactions,
  redeemLoyaltyPoints,
} from "./api";
import { loyaltyKeys } from "./query-keys";

export function useLoyalty(enabled = true) {
  return useQuery({
    queryKey: loyaltyKeys.account,
    queryFn: getLoyaltyAccount,
    enabled,
  });
}

export function useLoyaltyTransactions(enabled = true) {
  return useQuery({
    queryKey: loyaltyKeys.transactions,
    queryFn: async () => {
      const page = await listLoyaltyTransactions();
      if (!Array.isArray(page.results)) {
        throw new Error("loyalty/transactions: missing results");
      }
      return page.results;
    },
    enabled,
  });
}

export function useRedeemPoints() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { points: number; idempotencyKey?: string }) =>
      redeemLoyaltyPoints(
        { points: input.points },
        input.idempotencyKey,
      ),
    onSuccess: (account) => {
      queryClient.setQueryData(loyaltyKeys.account, account);
      queryClient.invalidateQueries({ queryKey: loyaltyKeys.transactions });
      queryClient.invalidateQueries({ queryKey: walletKeys.all });
    },
  });
}
