// types/inventory.ts
import { BaseFilter } from "@/lib/types/filters";

// ------------------------------------------------
// Enums / string unions
// ------------------------------------------------

export type MovementType =
  | "purchase"
  | "restock"
  | "refund"
  | "adjustment"
  | "reservation"
  | "release"
  | "damage";

// ------------------------------------------------
// Response types
// ------------------------------------------------

// Inventory record for a single product variant
export interface InventoryResponse {
  id: number;
  product_variant_id: number;
  stock_on_hand: number;
  committed_stock: number;
  available_stock: number; // computed: stock_on_hand - committed_stock
  reorder_point: number;
  reorder_quantity: number;
  last_restock_at?: string | null; // ISO datetime
  updated_at: string; // ISO datetime
}

// Inventory movement (history)
export interface InventoryMovementResponse {
  id: number;
  product_variant_id: number;
  quantity: number; // positive = added, negative = removed
  type: MovementType;
  reference_order_id?: number | null;
  note?: string | null;
  created_at: string; // ISO datetime
}

// ------------------------------------------------
// Request payloads
// ------------------------------------------------

// Used to adjust stock (create a movement)
export interface AdjustStockReq {
  quantity: number;
  type: MovementType;
  note?: string | null;
}

// Used to update reorder thresholds
export interface UpdateReorderReq {
  reorder_point?: number | null;
  reorder_quantity?: number | null;
}

// ------------------------------------------------
// Filters
// ------------------------------------------------

// Filter for inventory list (e.g., filter by low stock)
export interface InventoryFilter extends BaseFilter {
  low_stock?: boolean; // if true, only stock_on_hand <= reorder_point
}

// Filter for movement history
export interface MovementFilter extends BaseFilter {
  product_variant_id?: number;
  type?: MovementType;
  order_id?: number;
}
