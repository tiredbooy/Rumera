"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createProductAlert,
  deleteProductAlert,
  listProductAlerts,
} from "./api";
import { productAlertKeys } from "./query-keys";

export function useProductAlerts(enabled = true) {
  return useQuery({
    queryKey: productAlertKeys.all,
    queryFn: listProductAlerts,
    enabled,
  });
}

export function useCreateProductAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createProductAlert,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: productAlertKeys.all }),
  });
}

export function useDeleteProductAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteProductAlert,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: productAlertKeys.all }),
  });
}
