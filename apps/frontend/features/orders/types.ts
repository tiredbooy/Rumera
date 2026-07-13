import type { PaginationQuery } from "@/lib/api/types";

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

export interface OrderItem {
  id: number;
  product_id: number;
  variant_id: number;
  product_title: string;
  image_url?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface Order {
  id: number;
  status: OrderStatus;
  payment_method: PaymentMethod;
  subtotal: number;
  discount_amount: number;
  shipping_cost: number;
  tax_amount: number;
  total_amount: number;
  notes?: string;
  is_gift?: boolean;
  gift_message?: string;
  gift_wrap?: boolean;
  hide_price?: boolean;
  scheduled_delivery_date?: string;
  paid_at?: string;
  shipped_at?: string;
  delivered_at?: string;
  cancelled_at?: string;
  created_at: string;
  items: OrderItem[];
}

export interface OrderListItem {
  id: number;
  status: OrderStatus;
  payment_method: PaymentMethod;
  total_amount: number;
  item_count: number;
  created_at: string;
}

export interface CreateOrderInput {
  address_id: number;
  payment_method: PaymentMethod;
  shipping_method_id: number;
  coupon_code?: string | null;
  notes?: string | null;
  is_gift?: boolean;
  gift_message?: string | null;
  gift_wrap?: boolean;
  hide_price?: boolean;
  scheduled_delivery_date?: string | null;
}

export interface UpdateOrderStatusInput {
  status: OrderStatus;
}

export type OrderSortField = "created_at" | "total_amount" | "status";
export type OrderSortDirection = "asc" | "desc";

interface BaseOrderListQuery extends PaginationQuery {
  sortBy?: OrderSortField;
  orderBy?: OrderSortDirection;
  status?: OrderStatus;
  paid_from?: string;
  paid_to?: string;
}

export type AccountOrderListQuery = BaseOrderListQuery;

export interface AdminOrderListQuery extends BaseOrderListQuery {
  user_id?: number;
}
