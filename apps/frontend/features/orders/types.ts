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

export interface GiftAddonSnapshot {
  id: string;
  label: string;
  price: number;
}

export interface Order {
  id: number;
  status: OrderStatus;
  payment_method: PaymentMethod;
  /** Attached gateway intent (PR-020f). Absent on wallet / unpaid-unattached. */
  payment_id?: number;
  transaction_id?: string;
  /** Absolute start URL from the API. Empty when the gateway base is unset. */
  payment_url?: string;
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
  gift_addons_fee?: number;
  gift_addons?: GiftAddonSnapshot[];
  scheduled_delivery_date?: string;
  paid_at?: string;
  shipped_at?: string;
  delivered_at?: string;
  cancelled_at?: string;
  created_at: string;
  items: OrderItem[];
}

/** Buyer identity on an admin order row (CF-1). Absent on the customer's own list. */
export interface OrderListBuyer {
  id: number;
  user_id?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
}

export interface OrderListItem {
  id: number;
  status: OrderStatus;
  payment_method: PaymentMethod;
  total_amount: number;
  item_count: number;
  created_at: string;
  /** Admin list only — the customer's own list never carries it. */
  buyer?: OrderListBuyer;
}

export interface CreateOrderInput {
  address_id: number;
  payment_method: PaymentMethod;
  shipping_method_id: number;
  coupon_code?: string | null;
  notes?: string | null;
  is_gift?: boolean;
  gift_message?: string | null;
  /** @deprecated Prefer gift_option_ids; kept for older clients. */
  gift_wrap?: boolean;
  /** Admin-configured modular gift add-ons (server-priced). */
  gift_option_ids?: string[];
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
  /** Single value for GET /orders (`OrderFilter.Status`). Not a list. */
  status?: OrderStatus;
  paid_from?: string;
  paid_to?: string;
}

export type AccountOrderListQuery = BaseOrderListQuery;

export interface AdminOrderListQuery extends BaseOrderListQuery {
  user_id?: number;
  /**
   * Public customer identifier (CF-1). `user_id` above is the internal bigint,
   * which no customer-facing admin response ever emits — so it could only be
   * used by someone who already had an order open. This takes the UUID the
   * customers screen actually shows.
   */
  user_uuid?: string;
  /**
   * Comma-separated statuses (`OrderFilter.Statuses`), for queues that span
   * several states — "paid but not yet shipped" is paid + processing +
   * ready_to_ship. Admin-only; the account list has no use for it.
   */
  statuses?: string;
}
