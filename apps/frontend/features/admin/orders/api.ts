// features/admin/orders/api.ts
import { apiFetch } from "@/lib/api/client";
import { buildQueryString } from "@/lib/utils/api-helpers";

export type OrderStatus =
  | "pending"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "refunded";

export interface OrderListItem {
  id: number;
  created_at: string;
  total_amount: number;
  status: OrderStatus;
  // ... other fields as needed
}

export interface Paginated<T> {
  results: T[];
  total: number;
  page: number;
  limit: number;
}

export type ListOrdersParams = {
  page?: number;
  limit?: number;
  status?: OrderStatus;
  user_id?: number;
  search?: string;
  sort_by?: string;
  order_by?: "asc" | "desc";
};

/** GET /admin/orders — paginated order list. */
export function listOrders(
  params: ListOrdersParams = {},
): Promise<Paginated<OrderListItem>> {
  return apiFetch<Paginated<OrderListItem>>(
    `/admin/orders${buildQueryString(params)}`,
  );
}