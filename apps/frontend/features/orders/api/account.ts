import "server-only";

import { apiFetch } from "@/lib/api/client";
import type { Paginated } from "@/lib/api/types";
import { buildQueryString } from "@/lib/utils/api-helpers";

import type {
  AccountOrderListQuery,
  CreateOrderInput,
  Order,
  OrderListItem,
} from "../types";

export function createAccountOrder(data: CreateOrderInput): Promise<Order> {
  return apiFetch<Order>("/orders", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function listAccountOrders(
  query: AccountOrderListQuery = {},
): Promise<Paginated<OrderListItem>> {
  return apiFetch<Paginated<OrderListItem>>(
    `/orders${buildQueryString(query)}`,
  );
}

export function getAccountOrder(id: number): Promise<Order> {
  return apiFetch<Order>(`/orders/${id}`);
}

export function cancelAccountOrder(id: number): Promise<void> {
  return apiFetch<void>(`/orders/${id}/cancel`, { method: "POST" });
}
