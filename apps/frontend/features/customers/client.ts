"use client";

import type {
  ApiErrorEnvelope,
  ApiFieldErrors,
  ApiSuccess,
} from "@/lib/api/types";
import type {
  AdminUser,
  AdminUserCreateInput,
  AdminUserUpdateInput,
} from "./types";

export class AdminCustomerApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fields?: ApiFieldErrors,
  ) {
    super(message);
    this.name = "AdminCustomerApiError";
  }
}

async function customerRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`/api/admin/${path}`, {
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });

  if (response.status === 204) return undefined as T;

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const error = (body as ApiErrorEnvelope | null)?.error;
    throw new AdminCustomerApiError(
      response.status,
      error?.code ?? "UNKNOWN",
      error?.message ?? response.statusText,
      error?.fields,
    );
  }

  return ((body as ApiSuccess<T> | null)?.data ?? body) as T;
}

export function createAdminUser(
  input: AdminUserCreateInput,
): Promise<AdminUser> {
  return customerRequest<AdminUser>("admin/users", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateAdminUser(
  userID: string,
  input: AdminUserUpdateInput,
): Promise<AdminUser> {
  return customerRequest<AdminUser>(`admin/users/${userID}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deactivateAdminUser(userID: string): Promise<void> {
  return customerRequest<void>(`admin/users/${userID}`, {
    method: "DELETE",
  });
}
