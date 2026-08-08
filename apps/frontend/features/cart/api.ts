"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/query-keys";
import { storeRequest } from "@/lib/api/store-client";
import type { ApiSuccess } from "@/lib/api/types";
import { normalizeBulkAddResult, normalizeCart } from "./normalize";
import type {
  AddCartItemInput,
  BulkAddCartInput,
  BulkAddCartResult,
  Cart,
  UpdateCartItemInput,
} from "./types";

function assertAddCartInput(input: AddCartItemInput): AddCartItemInput {
  const product_variant_id = Number(input.product_variant_id);
  const quantity = Number(input.quantity);
  if (
    !Number.isFinite(product_variant_id) ||
    product_variant_id < 1 ||
    !Number.isFinite(quantity) ||
    quantity < 1
  ) {
    throw new Error("INVALID_CART_INPUT");
  }
  return {
    product_variant_id: Math.trunc(product_variant_id),
    quantity: Math.min(999, Math.trunc(quantity)),
  };
}

export function getCart(): Promise<Cart> {
  return storeRequest<ApiSuccess<Cart>>("cart").then((body) =>
    normalizeCart(body?.data),
  );
}

export function addCartItem(input: AddCartItemInput): Promise<Cart> {
  const payload = assertAddCartInput(input);
  return storeRequest<ApiSuccess<Cart>>("cart/items", {
    method: "POST",
    body: JSON.stringify(payload),
  }).then((body) => {
    if (!body?.data) {
      throw new Error("EMPTY_CART_RESPONSE");
    }
    return normalizeCart(body.data);
  });
}

export function bulkAddCartItems(
  items: AddCartItemInput[],
): Promise<BulkAddCartResult> {
  const input: BulkAddCartInput = {
    items: items.map(assertAddCartInput),
  };
  return storeRequest<ApiSuccess<BulkAddCartResult>>("cart/items/bulk", {
    method: "POST",
    body: JSON.stringify(input),
  }).then((body) => normalizeBulkAddResult(body?.data));
}

export function updateCartItem(
  itemId: number,
  input: UpdateCartItemInput,
): Promise<Cart> {
  return storeRequest<ApiSuccess<Cart>>(`cart/items/${itemId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  }).then((body) => normalizeCart(body?.data));
}

export function removeCartItem(itemId: number): Promise<Cart> {
  return storeRequest<ApiSuccess<Cart>>(`cart/items/${itemId}`, {
    method: "DELETE",
  }).then((body) => normalizeCart(body?.data));
}

export function clearCart(): Promise<void> {
  return storeRequest<void>("cart", { method: "DELETE" });
}

export function useCart(enabled = true) {
  return useQuery({ queryKey: queryKeys.cart, queryFn: getCart, enabled });
}

export function useAddCartItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: addCartItem,
    onSuccess: (cart) => queryClient.setQueryData(queryKeys.cart, cart),
  });
}

export function useBulkAddCartItems() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: bulkAddCartItems,
    onSuccess: (result) =>
      queryClient.setQueryData(queryKeys.cart, result.cart),
  });
}

export function useUpdateCartItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, ...input }: UpdateCartItemInput & { itemId: number }) =>
      updateCartItem(itemId, input),
    onSuccess: (cart) => queryClient.setQueryData(queryKeys.cart, cart),
  });
}

export function useRemoveCartItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: removeCartItem,
    onSuccess: (cart) => queryClient.setQueryData(queryKeys.cart, cart),
  });
}

export function useClearCart() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: clearCart,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.cart }),
  });
}
