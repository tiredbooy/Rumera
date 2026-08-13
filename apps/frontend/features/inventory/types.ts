import type { PaginationQuery } from "@/lib/api/types";

export type MovementType =
  | "purchase"
  | "restock"
  | "refund"
  | "adjustment"
  | "reservation"
  | "release"
  | "damage";

export interface InventoryItem {
  id: number;
  product_variant_id: number;
  product_id: number;
  product_title: string;
  sku?: string;
  category_title?: string;
  unit_price: string;
  /** Package weight in kg from products.weight (PH-020a). Omitted when unset. */
  weight?: number;
  /**
   * True when catalogue weight is null or not positive — admin shipping
   * remediation signal (085a / PH-020b). Always present from API.
   */
  missing_weight: boolean;
  stock_on_hand: number;
  committed_stock: number;
  available_stock: number;
  reorder_point: number;
  reorder_quantity: number;
  last_restock_at?: string;
  updated_at: string;
}

export interface InventoryMovement {
  id: number;
  product_variant_id: number;
  quantity: number;
  type: MovementType;
  reference_order_id?: number;
  note?: string;
  created_at: string;
}

export interface AdjustStockInput {
  quantity: number;
  type: Extract<
    MovementType,
    "purchase" | "restock" | "refund" | "adjustment" | "damage"
  >;
  note?: string | null;
}

export interface UpdateReorderThresholdInput {
  reorder_point?: number;
  reorder_quantity?: number;
}

export type InventorySortField =
  | "id"
  | "updated_at"
  | "stock_on_hand"
  | "available_stock"
  | "reorder_point"
  | "product_title"
  | "sku";

export interface InventoryListQuery extends PaginationQuery {
  sortBy?: InventorySortField;
  orderBy?: "asc" | "desc";
  search?: string;
  low_stock?: boolean;
}

export interface InventoryMovementListQuery extends PaginationQuery {
  sortBy?: "created_at";
  orderBy?: "asc" | "desc";
  product_variant_id?: number;
  type?: MovementType;
  order_id?: number;
}

export type InventoryStatus = "in_stock" | "low" | "out";
