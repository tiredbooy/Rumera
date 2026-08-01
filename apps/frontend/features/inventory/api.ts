import "server-only";

import { apiFetch } from "@/lib/api/client";
import type { Paginated } from "@/lib/api/types";
import { buildQueryString } from "@/lib/utils/api-helpers";

import type {
  AdjustStockInput,
  InventoryItem,
  InventoryListQuery,
  InventoryMovement,
  InventoryMovementListQuery,
  UpdateReorderThresholdInput,
} from "./types";

export function listInventory(
  query: InventoryListQuery = {},
): Promise<Paginated<InventoryItem>> {
  return apiFetch<Paginated<InventoryItem>>(
    `/admin/inventory${buildQueryString(query)}`,
  );
}

export async function listAllInventory(): Promise<InventoryItem[]> {
  const first = await listInventory({
    page: 1,
    limit: 100,
    sortBy: "id",
    orderBy: "asc",
  });
  if (first.pagination.total_pages <= 1) return first.results;

  const remaining = await Promise.all(
    Array.from({ length: first.pagination.total_pages - 1 }, (_, index) =>
      listInventory({
        page: index + 2,
        limit: 100,
        sortBy: "id",
        orderBy: "asc",
      }),
    ),
  );
  return [first, ...remaining].flatMap((page) => page.results);
}

export function fetchLowStockInventory(): Promise<InventoryItem[]> {
  return apiFetch<InventoryItem[]>("/admin/inventory/low-stock");
}

export function getVariantInventory(variantID: number): Promise<InventoryItem> {
  return apiFetch<InventoryItem>(`/admin/inventory/variants/${variantID}`);
}

export function adjustVariantStock(
  variantID: number,
  input: AdjustStockInput,
): Promise<void> {
  return apiFetch<void>(`/admin/inventory/variants/${variantID}/adjust`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateVariantReorderThreshold(
  variantID: number,
  input: UpdateReorderThresholdInput,
): Promise<InventoryItem> {
  return apiFetch<InventoryItem>(
    `/admin/inventory/variants/${variantID}/reorder`,
    { method: "PATCH", body: JSON.stringify(input) },
  );
}

export function listInventoryMovements(
  query: InventoryMovementListQuery = {},
): Promise<Paginated<InventoryMovement>> {
  return apiFetch<Paginated<InventoryMovement>>(
    `/admin/inventory/movements${buildQueryString(query)}`,
  );
}

export function listVariantInventoryMovements(
  variantID: number,
): Promise<InventoryMovement[]> {
  return apiFetch<InventoryMovement[]>(
    `/admin/inventory/variants/${variantID}/movements`,
  );
}
