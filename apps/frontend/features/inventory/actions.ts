"use server";

import { revalidatePath } from "next/cache";

import { ApiError } from "@/lib/api/errors";
import type { ApiFieldErrors } from "@/lib/api/types";

import { adjustVariantStock, updateVariantReorderThreshold } from "./api";
import type {
  AdjustStockInput,
  InventoryItem,
  UpdateReorderThresholdInput,
} from "./types";

export type InventoryActionResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: {
        code: string;
        message: string;
        fields?: ApiFieldErrors;
      };
    };

function failure<T>(error: unknown): InventoryActionResult<T> {
  if (error instanceof ApiError) {
    return {
      ok: false,
      error: {
        code: error.code,
        message: error.message,
        fields: error.fields,
      },
    };
  }
  return {
    ok: false,
    error: {
      code: "UNKNOWN",
      message: "عملیات موجودی انجام نشد",
    },
  };
}

function revalidateInventory(variantID: number) {
  try {
    revalidatePath("/admin");
    revalidatePath("/admin/inventory");
    revalidatePath(`/admin/inventory/${variantID}`);
  } catch (error) {
    console.error("inventory cache revalidation failed", error);
  }
}

export async function adjustVariantStockAction({
  variantID,
  input,
}: {
  variantID: number;
  input: AdjustStockInput;
}): Promise<InventoryActionResult<null>> {
  try {
    await adjustVariantStock(variantID, input);
  } catch (error) {
    return failure(error);
  }
  revalidateInventory(variantID);
  return { ok: true, data: null };
}

export async function updateVariantReorderAction({
  variantID,
  input,
}: {
  variantID: number;
  input: UpdateReorderThresholdInput;
}): Promise<InventoryActionResult<InventoryItem>> {
  let inventory: InventoryItem;
  try {
    inventory = await updateVariantReorderThreshold(variantID, input);
  } catch (error) {
    return failure(error);
  }
  revalidateInventory(variantID);
  return { ok: true, data: inventory };
}
