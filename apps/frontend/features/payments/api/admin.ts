import "server-only";

import { apiFetch } from "@/lib/api/client";
import { buildQuery } from "@/lib/api/qs";
import type { Paginated } from "@/lib/api/types";

import type {
  AdminPaymentTransaction,
  PaymentTransactionListQuery,
} from "../types";

export function listAdminPayments(
  query: PaymentTransactionListQuery = {},
): Promise<Paginated<AdminPaymentTransaction>> {
  return apiFetch<Paginated<AdminPaymentTransaction>>(
    `/admin/payments${buildQuery({ ...query })}`,
  );
}

export function getAdminPayment(
  id: number,
): Promise<AdminPaymentTransaction> {
  return apiFetch<AdminPaymentTransaction>(`/admin/payments/${id}`);
}

export function getAdminPaymentByTransactionID(
  transactionID: string,
): Promise<AdminPaymentTransaction> {
  return apiFetch<AdminPaymentTransaction>(
    `/admin/payments/by-transaction/${encodeURIComponent(transactionID)}`,
  );
}
