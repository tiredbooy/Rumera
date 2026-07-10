// types/order.ts
import { BaseFilter } from "@/lib/types/filters";

export type OrderStatus =
  | "pending"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "refunded";

export interface OrderItem {
  id: number;
  variant_id: number;
  product_title: string;
  variant_sku?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  // ... other fields as needed
}

export interface OrderAddress {
  // shipping/billing address fields
  first_name: string;
  last_name: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  state?: string;
  postal_code: string;
  country: string;
  phone?: string;
}

export interface OrderResponse {
  id: number;
  user_id: number;
  status: OrderStatus;
  total_amount: number;
  subtotal: number;
  discount_amount?: number;
  shipping_amount?: number;
  tax_amount?: number;
  payment_method?: string;
  shipping_address: OrderAddress;
  billing_address?: OrderAddress;
  items: OrderItem[];
  created_at: string;
  updated_at: string;
}

export interface OrderListItem {
  id: number;
  user_id: number;
  user_name?: string;
  status: OrderStatus;
  total_amount: number;
  created_at: string;
  // maybe last update etc.
}

export interface CreateOrderReq {
  items: Array<{
    variant_id: number;
    quantity: number;
  }>;
  shipping_address: OrderAddress;
  billing_address?: OrderAddress;
  payment_method: string;
  coupon_code?: string;
  gift_card_code?: string;
}

export interface UpdateOrderStatusReq {
  status: OrderStatus;
}

// Filters
export interface OrderFilter extends BaseFilter {
  status?: OrderStatus;
  user_id?: number;
  from_date?: string;
  to_date?: string;
}
