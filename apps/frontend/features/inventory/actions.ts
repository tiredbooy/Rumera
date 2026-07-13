"use server";

import { revalidatePath } from "next/cache";

import { adjustVariantStock } from "./api";
import type { AdjustStockInput } from "./types";

export async function adjustVariantStockAction({
  variantID,
  input,
}: {
  variantID: number;
  input: AdjustStockInput;
}): Promise<void> {
  await adjustVariantStock(variantID, input);
  revalidatePath("/admin");
  revalidatePath("/admin/inventory");
}
