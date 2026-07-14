"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  addWishlistItem,
  clearWishlist,
  getWishlist,
  hasWishlistItem,
  removeWishlistItem,
} from "./api";
import { wishlistKeys } from "./query-keys";
import type { Wishlist } from "./types";

export function useWishlist(enabled = true) {
  return useQuery({
    queryKey: wishlistKeys.all,
    queryFn: getWishlist,
    enabled,
  });
}

export function useAddWishlistItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: addWishlistItem,
    onMutate: async (variantId) => {
      await queryClient.cancelQueries({ queryKey: wishlistKeys.all });
      const previous = queryClient.getQueryData<Wishlist>(wishlistKeys.all);
      if (
        previous &&
        !previous.items.some((item) => item.variant_id === variantId)
      ) {
        const optimistic: Wishlist["items"][number] = {
          id: -variantId,
          product_id: 0,
          product_title: "",
          variant_id: variantId,
          price: 0,
          is_in_stock: true,
          added_at: new Date().toISOString(),
        };
        queryClient.setQueryData<Wishlist>(wishlistKeys.all, {
          ...previous,
          items: [optimistic, ...previous.items],
          total: previous.total + 1,
        });
      }
      queryClient.setQueryData(wishlistKeys.membership(variantId), true);
      return { previous };
    },
    onError: (_error, variantId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(wishlistKeys.all, context.previous);
      }
      queryClient.setQueryData(wishlistKeys.membership(variantId), false);
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: wishlistKeys.all }),
  });
}

export function useRemoveWishlistItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: removeWishlistItem,
    onMutate: async (itemId) => {
      await queryClient.cancelQueries({ queryKey: wishlistKeys.all });
      const previous = queryClient.getQueryData<Wishlist>(wishlistKeys.all);
      if (previous) {
        const removed = previous.items.find((item) => item.id === itemId);
        queryClient.setQueryData<Wishlist>(wishlistKeys.all, {
          ...previous,
          items: previous.items.filter((item) => item.id !== itemId),
          total: Math.max(0, previous.total - 1),
        });
        if (removed) {
          queryClient.setQueryData(
            wishlistKeys.membership(removed.variant_id),
            false,
          );
        }
      }
      return { previous };
    },
    onError: (_error, _itemId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(wishlistKeys.all, context.previous);
      }
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: wishlistKeys.all }),
  });
}

export function useClearWishlist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: clearWishlist,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: wishlistKeys.all }),
  });
}

export function useHasWishlistItem(
  variantId: number | undefined,
  enabled = true,
) {
  return useQuery({
    queryKey: wishlistKeys.membership(variantId),
    queryFn: () => hasWishlistItem(variantId!),
    enabled: enabled && variantId !== undefined,
  });
}
