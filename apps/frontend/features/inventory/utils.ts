import type { InventoryItem, InventoryStatus } from "./types";

export function getInventoryStatus(row: InventoryItem): InventoryStatus {
  if (row.available_stock <= 0) return "out";
  if (row.available_stock <= row.reorder_point) return "low";
  return "in_stock";
}
