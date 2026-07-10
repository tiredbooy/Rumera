// features/admin/inventory/api.ts
import { apiFetch } from "@/lib/api/client";

export type AdminInventoryRow = {
  id: number;
  product_variant_id: number;
  stock_on_hand: number;
  committed_stock: number;
  available_stock: number;
  reorder_point: number;
  reorder_quantity: number;
  last_restock_at?: string | null;
  updated_at: string;
};

/** GET /admin/inventory/low-stock — variants at/below their reorder point. */
export function fetchLowStockInventory(): Promise<AdminInventoryRow[]> {
  return apiFetch<AdminInventoryRow[]>("/admin/inventory/low-stock");
}
