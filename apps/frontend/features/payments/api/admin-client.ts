"use client";

import { buildQuery } from "@/lib/api/qs";
import type { ApiErrorEnvelope, ApiSuccess, Paginated } from "@/lib/api/types";

import type {
  AdminPaymentTransaction,
  PaymentTransactionListQuery,
} from "../types";

export class PaymentApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "PaymentApiError";
  }
}

async function adminPaymentRequest<T>(path: string): Promise<T> {
  const response = await fetch(`/api/admin/admin/payments${path}`);
  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const error = (body as ApiErrorEnvelope | null)?.error;
    throw new PaymentApiError(
      response.status,
      error?.code ?? "UNKNOWN",
      error?.message ?? response.statusText,
    );
  }

  return ((body as ApiSuccess<T> | null)?.data ?? body) as T;
}

export function listAdminPaymentsClient(
  query: PaymentTransactionListQuery = {},
): Promise<Paginated<AdminPaymentTransaction>> {
  return adminPaymentRequest<Paginated<AdminPaymentTransaction>>(
    buildQuery({ ...query }),
  );
}

export function getAdminPaymentClient(
  id: number,
): Promise<AdminPaymentTransaction> {
  return adminPaymentRequest<AdminPaymentTransaction>(`/${id}`);
}

export function getAdminPaymentByTransactionIDClient(
  transactionID: string,
): Promise<AdminPaymentTransaction> {
  return adminPaymentRequest<AdminPaymentTransaction>(
    `/by-transaction/${encodeURIComponent(transactionID)}`,
  );
}
