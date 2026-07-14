"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { walletKeys } from "@/features/wallet/query-keys";

import { redeemGiftCard } from "./api/account";
import { createGiftCardsClient } from "./api/admin-client";

export function useRedeemGiftCard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: redeemGiftCard,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: walletKeys.all }),
  });
}

export function useCreateGiftCards() {
  return useMutation({ mutationFn: createGiftCardsClient });
}
