"use client";

import type {
  ApiErrorEnvelope,
  ApiFieldErrors,
  ApiSuccess,
  Paginated,
} from "@/lib/api/types";
import { buildQueryString } from "@/lib/utils/api-helpers";

import type {
  AdminOrderListQuery,
  OrderListItem,
  UpdateOrderStatusInput,
} from "../types";

export class AdminOrderClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fields?: ApiFieldErrors,
  ) {
    super(message);
    this.name = "AdminOrderClientError";
  }
}

async function adminOrderRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`/api/admin/admin/orders${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const error = (body as ApiErrorEnvelope | null)?.error;
    throw new AdminOrderClientError(
      response.status,
      error?.code ?? "UNKNOWN",
      error?.message ?? response.statusText,
      error?.fields,
    );
  }

  return ((body as ApiSuccess<T> | null)?.data ?? body) as T;
}

export function listAdminOrdersClient(
  query: AdminOrderListQuery = {},
): Promise<Paginated<OrderListItem>> {
  return adminOrderRequest<Paginated<OrderListItem>>(
    buildQueryString(query),
  );
}

export function updateAdminOrderStatusClient(
  id: number,
  data: UpdateOrderStatusInput,
): Promise<OrderListItem> {
  return adminOrderRequest<OrderListItem>(`/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

/** POST /admin/orders/:id/refund — money command, not a status PATCH (PR-020d / PR-062b). */
export function refundAdminOrderClient(id: number): Promise<OrderListItem> {
  return adminOrderRequest<OrderListItem>(`/${id}/refund`, {
    method: "POST",
  });
}
