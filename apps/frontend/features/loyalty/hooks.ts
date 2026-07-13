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
    queryFn: listLoyaltyTransactions,
    enabled,
  });
}

export function useRedeemPoints() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: redeemLoyaltyPoints,
    onSuccess: (account) => {
      queryClient.setQueryData(loyaltyKeys.account, account);
      queryClient.invalidateQueries({ queryKey: loyaltyKeys.transactions });
      queryClient.invalidateQueries({ queryKey: walletKeys.all });
    },
  });
}
