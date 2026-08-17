"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { walletKeys } from "@/features/wallet/query-keys";

import {
  listMyGiftCards,
  purchaseGiftCard,
  redeemGiftCard,
} from "./api/account";
import {
  createGiftCardsClient,
  listAdminGiftCardsClient,
  voidAdminGiftCardClient,
} from "./api/admin-client";
import type {
  AdminGiftCardListQuery,
  PurchaseGiftCardInput,
  RedeemGiftCardInput,
} from "./types";

export const giftCardKeys = {
  all: ["gift-cards"] as const,
  mine: ["gift-cards", "mine"] as const,
  admin: ["gift-cards", "admin"] as const,
  adminLists: () => [...giftCardKeys.admin, "list"] as const,
  adminList: (query: AdminGiftCardListQuery) =>
    [...giftCardKeys.adminLists(), query] as const,
};

/** Gateway purchase intent. Code is issued only after webhook Confirm. */
export function usePurchaseGiftCard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: PurchaseGiftCardInput & { idempotencyKey?: string }) =>
      purchaseGiftCard({ amount: input.amount }, input.idempotencyKey),
    onSuccess: () => {
      // Pending only — still refresh mine in case a prior payment settled.
      queryClient.invalidateQueries({ queryKey: giftCardKeys.mine });
    },
  });
}

/** Purchased codes for the signed-in customer (self-delivery). */
export function useMyGiftCards(enabled = true) {
  return useQuery({
    queryKey: giftCardKeys.mine,
    queryFn: listMyGiftCards,
    enabled,
  });
}

export function useRedeemGiftCard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: RedeemGiftCardInput & { idempotencyKey?: string }) =>
      redeemGiftCard({ code: input.code }, input.idempotencyKey),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: walletKeys.all });
      queryClient.invalidateQueries({ queryKey: giftCardKeys.mine });
    },
  });
}

export function useAdminGiftCards(
  query: AdminGiftCardListQuery = {},
  enabled = true,
) {
  return useQuery({
    queryKey: giftCardKeys.adminList(query),
    queryFn: () => listAdminGiftCardsClient(query),
    enabled,
    placeholderData: (previous) => previous,
  });
}

export function useVoidGiftCard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: voidAdminGiftCardClient,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: giftCardKeys.adminLists() });
    },
  });
}

export function useCreateGiftCards() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createGiftCardsClient,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: giftCardKeys.adminLists() });
    },
  });
}
