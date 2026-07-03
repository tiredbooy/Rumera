import { BaseFilter } from "@/lib/types/filters";

// ------------------------------------------------
// Enums (string unions)
// ------------------------------------------------

export type OrderStatus =
  | "pending"
  | "payment_failed"
  | "paid"
  | "processing"
  | "ready_to_ship"
  | "shipped"
  | "out_for_delivery"
  | "delivered"
  | "refund_requested"
  | "refund_approved"
  | "refunded"
  | "partially_refunded"
  | "cancelled";

export type PaymentMethod =
  | "card"
  | "crypto"
  | "bank_transfer"
  | "wallet"
  | "gateway";

// ------------------------------------------------
// Core entity (full order with items)
// ------------------------------------------------

export interface OrderItemResponse {
  id: number;
  product_id: number;
  variant_id: number; // corresponds to ProductVariantID
  product_title: string;
  image_url?: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface OrderResponse {
  id: number;
  status: OrderStatus;
  payment_method: PaymentMethod;
  subtotal: number;
  discount_amount: number;
  shipping_cost: number;
  tax_amount: number;
  total_amount: number;
  notes?: string | null;

  // Gift / delivery options
  is_gift?: boolean;
  gift_message?: string | null;
  gift_wrap?: boolean;
  hide_price?: boolean;
  scheduled_delivery_date?: string | null; // ISO datetime

  // Timestamps
  paid_at?: string | null;
  shipped_at?: string | null;
  delivered_at?: string | null;
  cancelled_at?: string | null;
  created_at: string; // ISO datetime

  items: OrderItemResponse[];
}

// ------------------------------------------------
// List item (lightweight)
// ------------------------------------------------

export interface OrderListItem {
  id: number;
  status: OrderStatus;
  payment_method: PaymentMethod;
  total_amount: number;
  item_count: number;
  created_at: string; // ISO datetime
}

// ------------------------------------------------
// Request payloads
// ------------------------------------------------

export interface CreateOrderReq {
  address_id: number;
  payment_method: PaymentMethod;
  shipping_method_id: number;
  coupon_code?: string | null;
  notes?: string | null;

  // Gift options
  is_gift?: boolean;
  gift_message?: string | null;
  gift_wrap?: boolean;
  hide_price?: boolean;
  scheduled_delivery_date?: string | null; // ISO datetime
}

export interface UpdateOrderStatusReq {
  status: OrderStatus;
}

// ------------------------------------------------
// Filter (extends BaseFilter)
// ------------------------------------------------

export interface OrderFilter extends BaseFilter {
  user_id?: number;
  status?: OrderStatus;
  paid_from?: string; // ISO datetime
  paid_to?: string; // ISO datetime
}
