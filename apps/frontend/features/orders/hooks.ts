"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/api/query-keys";

import {
  cancelAccountOrderClient,
  createAccountOrderClient,
  getAccountOrderClient,
  listAccountOrdersClient,
} from "./api/account-client";
import { orderKeys } from "./query-keys";
import type { AccountOrderListQuery } from "./types";

export function usePlaceOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createAccountOrderClient,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cart });
      queryClient.invalidateQueries({ queryKey: orderKeys.all });
    },
  });
}

export function useOrders(
  query: AccountOrderListQuery = {},
  enabled = true,
) {
  return useQuery({
    queryKey: orderKeys.list(query),
    queryFn: () => listAccountOrdersClient(query),
    enabled,
  });
}

export function useOrder(id: number, enabled = true) {
  return useQuery({
    queryKey: orderKeys.detail(id),
    queryFn: () => getAccountOrderClient(id),
    enabled: enabled && Number.isInteger(id) && id > 0,
  });
}

export function useCancelOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: cancelAccountOrderClient,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: orderKeys.all }),
  });
}
