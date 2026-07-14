"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  listAdminOrdersClient,
  updateAdminOrderStatusClient,
} from "@/features/orders/api/admin-client";
import { adminOrderKeys } from "@/features/orders/query-keys";
import type {
  AdminOrderListQuery,
  UpdateOrderStatusInput,
} from "@/features/orders/types";

export function useAdminOrders(query: AdminOrderListQuery = {}) {
  return useQuery({
    queryKey: adminOrderKeys.list(query),
    queryFn: () => listAdminOrdersClient(query),
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
