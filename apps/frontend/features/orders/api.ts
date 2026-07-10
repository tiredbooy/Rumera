// features/orders/api.ts

import "server-only";

import { apiFetch } from "@/lib/api/client";
import { buildQueryString } from "@/lib/utils/api-helpers";

import type {
  CreateOrderRequest,
  Order,
  OrderFilter,
  OrderListItem,
  UpdateOrderStatusRequest,
} from "./types";

/* -------------------------------------------------------------------------- */
/*                                Customer API                                */
/* -------------------------------------------------------------------------- */

export function createOrder(data: CreateOrderRequest): Promise<Order> {
  return apiFetch<Order>("/orders", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function fetchMyOrders(
  filter: OrderFilter = {},
): Promise<OrderListItem[]> {
  return apiFetch<OrderListItem[]>(`/orders${buildQueryString(filter)}`);
}

export function fetchMyOrder(id: number): Promise<Order> {
  return apiFetch<Order>(`/orders/${id}`);
}

export function cancelOrder(id: number): Promise<void> {
  return apiFetch<void>(`/orders/${id}/cancel`, {
    method: "POST",
  });
}

/* -------------------------------------------------------------------------- */
/*                                 Admin API                                  */
/* -------------------------------------------------------------------------- */

export function fetchOrders(
  filter: OrderFilter = {},
): Promise<OrderListItem[]> {
  return apiFetch<OrderListItem[]>(`/admin/orders${buildQueryString(filter)}`);
}

export function fetchOrder(id: number): Promise<Order> {
  return apiFetch<Order>(`/admin/orders/${id}`);
}

export function updateOrderStatus(
  id: number,
  data: UpdateOrderStatusRequest,
): Promise<OrderListItem> {
  return apiFetch<OrderListItem>(`/admin/orders/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}
