import type { Order } from "@/features/orders/types";

/** Frozen ship-to snapshot from GET /admin/orders/:id (PR-020i). */
export interface AdminOrderShipTo {
  full_name: string;
  phone_number?: string | null;
  address_line1: string;
  address_line2?: string | null;
  city: string;
  state_province?: string | null;
  postal_code?: string;
  country?: string;
}

/** Safe buyer projection — no password / national code. */
export interface AdminOrderUser {
  id: number;
  user_id?: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string;
  phone?: string | null;
}

export interface AdminOrderShippingMethod {
  id: number;
  name?: string;
  carrier?: string | null;
}

export interface AdminOrderCoupon {
  id?: number;
  code: string;
}

/** Attached gateway intent when present (wallet checkout omits this). */
export interface AdminOrderPaymentSummary {
  id: number;
  transaction_id: string;
  status?: string;
  payment_url?: string;
}

/** Admin GET projection: Order (gift / notes / schedule already on the DTO) plus identity / ship-to / method / coupon / payment. */
export interface AdminOrder extends Order {
  user_id?: number;
  address_id?: number | null;
  shipping_method_id?: number | null;
  coupon_id?: number | null;
  coupon_code?: string | null;
  user?: AdminOrderUser | null;
  address?: AdminOrderShipTo | null;
  ship_to?: AdminOrderShipTo | null;
  shipping_method?: AdminOrderShippingMethod | null;
  coupon?: AdminOrderCoupon | null;
  payment?: AdminOrderPaymentSummary | null;
  payment_id?: number;
  transaction_id?: string;
  payment_url?: string;
}
