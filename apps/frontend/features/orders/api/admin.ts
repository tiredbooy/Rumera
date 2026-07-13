import "server-only";

import { apiFetch } from "@/lib/api/client";
import type { Paginated } from "@/lib/api/types";
import { buildQueryString } from "@/lib/utils/api-helpers";

import type {
  AdminOrderListQuery,
  Order,
  OrderListItem,
  UpdateOrderStatusInput,
} from "../types";

export function listAdminOrders(
  query: AdminOrderListQuery = {},
): Promise<Paginated<OrderListItem>> {
  return apiFetch<Paginated<OrderListItem>>(
    `/admin/orders${buildQueryString(query)}`,
  );
}

export function getAdminOrder(id: number): Promise<Order> {
  return apiFetch<Order>(`/admin/orders/${id}`);
}

export function updateAdminOrderStatus(
  id: number,
  data: UpdateOrderStatusInput,
): Promise<OrderListItem> {
  return apiFetch<OrderListItem>(`/admin/orders/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}
