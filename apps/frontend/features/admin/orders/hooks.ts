"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  listAdminOrdersClient,
  refundAdminOrderClient,
  updateAdminOrderStatusClient,
} from "@/features/orders/api/admin-client";
import { adminOrderKeys } from "@/features/orders/query-keys";
import type {
  AdminOrderListQuery,
  UpdateOrderStatusInput,
} from "@/features/orders/types";

/** Visible-tab poll — ED-043. Not a socket. */
export const ADMIN_ORDERS_POLL_MS = 20_000;

export const ADMIN_ORDERS_POLL = {
  refetchInterval: ADMIN_ORDERS_POLL_MS,
  refetchIntervalInBackground: false,
  refetchOnWindowFocus: true,
} as const;

export function useAdminOrders(query: AdminOrderListQuery = {}) {
  return useQuery({
    queryKey: adminOrderKeys.list(query),
    queryFn: () => listAdminOrdersClient(query),
    ...ADMIN_ORDERS_POLL,
  });
}

export function useUpdateAdminOrderStatus(orderId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateOrderStatusInput) =>
      updateAdminOrderStatusClient(orderId, data),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: adminOrderKeys.all }),
  });
}

export function useRefundAdminOrder(orderId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => refundAdminOrderClient(orderId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: adminOrderKeys.all }),
  });
}
