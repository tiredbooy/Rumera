"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { ApiFieldErrors } from "@/lib/api/types";

import {
  adjustVariantStockAction,
  type InventoryActionResult,
  updateVariantReorderAction,
} from "./actions";
import { inventoryKeys } from "./query-keys";

export class InventoryMutationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly fields?: ApiFieldErrors,
  ) {
    super(message);
    this.name = "InventoryMutationError";
  }
}

function unwrapInventoryAction<T>(result: InventoryActionResult<T>): T {
  if (!result.ok) {
    throw new InventoryMutationError(
      result.error.code,
      result.error.message,
      result.error.fields,
    );
  }
  return result.data;
}

export function useAdjustVariantStock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: Parameters<typeof adjustVariantStockAction>[0]) =>
      unwrapInventoryAction(await adjustVariantStockAction(input)),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: inventoryKeys.all }),
  });
}

export function useUpdateVariantReorder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      input: Parameters<typeof updateVariantReorderAction>[0],
    ) => unwrapInventoryAction(await updateVariantReorderAction(input)),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: inventoryKeys.all }),
  });
}
