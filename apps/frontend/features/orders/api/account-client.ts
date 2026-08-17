"use client";

import { ApiClientError, storeRequest } from "@/lib/api/store-client";
import type { ApiSuccess, Paginated } from "@/lib/api/types";
import { buildQueryString } from "@/lib/utils/api-helpers";

import type {
  AccountOrderListQuery,
  CreateOrderInput,
  Order,
  OrderListItem,
} from "../types";

export function createAccountOrderClient(
  data: CreateOrderInput,
): Promise<Order> {
  return storeRequest<ApiSuccess<Order>>("orders", {
    method: "POST",
    body: JSON.stringify(data),
  }).then((body) => body.data);
}

export function listAccountOrdersClient(
  query: AccountOrderListQuery = {},
): Promise<Paginated<OrderListItem>> {
  return storeRequest<Paginated<OrderListItem>>(
    `orders${buildQueryString(query)}`,
  );
}

export async function getAccountOrderClient(id: number): Promise<Order | null> {
  try {
    const body = await storeRequest<ApiSuccess<Order>>(`orders/${id}`);
    return body.data;
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 404) return null;
    throw error;
  }
}

export function cancelAccountOrderClient(id: number): Promise<void> {
  return storeRequest<void>(`orders/${id}/cancel`, { method: "POST" });
}

export function newOrderPayIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `opay-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

/** Starts or returns a pending gateway intent (PR-020f). Does not invent a URL. */
export function payAccountOrderClient(
  id: number,
  idempotencyKey?: string,
): Promise<Order> {
  const key = (idempotencyKey ?? newOrderPayIdempotencyKey()).trim();
  return storeRequest<ApiSuccess<Order>>(`orders/${id}/pay`, {
    method: "POST",
    headers: key ? { "Idempotency-Key": key } : undefined,
  }).then((body) => body.data);
}
