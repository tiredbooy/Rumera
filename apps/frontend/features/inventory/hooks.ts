"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { adjustVariantStockAction } from "./actions";
import { inventoryKeys } from "./query-keys";

export function useAdjustVariantStock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: adjustVariantStockAction,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: inventoryKeys.all }),
  });
}
