"use server";

import { revalidatePath } from "next/cache";

import { adjustVariantStock } from "@/features/inventory/api";
import type { InventoryActionResult } from "@/features/inventory/actions";
import type { AdjustStockInput } from "@/features/inventory/types";
import { ApiError } from "@/lib/api/errors";

/** One ledger movement, exactly the payload the single adjust sends. */
export type BulkStockAdjustment = AdjustStockInput & { variantID: number };

export type BulkStockAdjustmentReport = {
  /** Variants whose movement was recorded. */
  applied: number[];
  /** Variants whose movement was refused, with the reason the API gave. */
  failed: { variantID: number; code: string; message: string }[];
};

/**
 * A batch never exceeds one page of the list (20 rows), so this only bounds a
 * hand-crafted call — a server action is a public endpoint.
 */
const MAX_BULK_ADJUSTMENTS = 100;

function revalidateInventory(variantIDs: number[]) {
  try {
    revalidatePath("/admin");
    revalidatePath("/admin/inventory");
    for (const variantID of variantIDs) {
      revalidatePath(`/admin/inventory/${variantID}`);
    }
  } catch (error) {
    console.error("inventory cache revalidation failed", error);
  }
}

/**
 * Applies one stock movement per selected variant through the same
 * `/adjust` endpoint the single popover uses — same transaction, same
 * `inventory_movements` row, same reason and note. There is no bulk write path
 * behind the ledger, and there must not be one.
 *
 * Partial failure is per-row and never rolled back. Three reasons:
 *
 *   - A restock records a physical event that already happened. Discarding 37
 *     recorded deliveries because 3 rows were stale would force the operator to
 *     key them in again, and the warehouse would still hold the bottles.
 *   - All-or-nothing would need a new transactional bulk endpoint on the Go
 *     side, i.e. a second write path around the audit trail the single adjust
 *     enforces.
 *   - Retry stays safe because the caller drops the applied rows from the
 *     selection: what is left to retry is exactly the failures, so a second
 *     submit cannot double-apply a movement.
 *
 * The whole batch is refused only before anything is written (over the cap), so
 * "refused" and "partially applied" are never ambiguous.
 */
export async function bulkAdjustVariantStockAction(
  adjustments: BulkStockAdjustment[],
): Promise<InventoryActionResult<BulkStockAdjustmentReport>> {
  if (adjustments.length === 0 || adjustments.length > MAX_BULK_ADJUSTMENTS) {
    return {
      ok: false,
      error: {
        code: "INVALID_REQUEST",
        message: "تعداد ردیف‌های این درخواست معتبر نیست",
      },
    };
  }

  const report: BulkStockAdjustmentReport = { applied: [], failed: [] };

  // ponytail: sequential. A page is 20 rows against the API next door, and one
  // movement at a time keeps the ledger order readable; batch server-side only
  // if a page ever carries hundreds of rows.
  for (const { variantID, ...input } of adjustments) {
    try {
      await adjustVariantStock(variantID, input);
      report.applied.push(variantID);
    } catch (error) {
      report.failed.push({
        variantID,
        code: error instanceof ApiError ? error.code : "UNKNOWN",
        message: error instanceof ApiError ? error.message : "",
      });
    }
  }

  if (report.applied.length > 0) {
    revalidateInventory(report.applied);
  }
  return { ok: true, data: report };
}
