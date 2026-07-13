"use client";

import { useQuery } from "@tanstack/react-query";

import {
  getAdminPaymentByTransactionIDClient,
  getAdminPaymentClient,
  listAdminPaymentsClient,
} from "./api/admin-client";
import { adminPaymentKeys } from "./query-keys";
import type { PaymentTransactionListQuery } from "./types";

export function useAdminPayments(
  query: PaymentTransactionListQuery = {},
  enabled = true,
) {
  return useQuery({
    queryKey: adminPaymentKeys.list(query),
    queryFn: () => listAdminPaymentsClient(query),
    enabled,
    placeholderData: (previous) => previous,
  });
}

export function useAdminPayment(id: number, enabled = true) {
  return useQuery({
    queryKey: adminPaymentKeys.detail(id),
    queryFn: () => getAdminPaymentClient(id),
    enabled: enabled && Number.isInteger(id) && id > 0,
  });
}

export function useAdminPaymentByTransactionID(
  transactionID: string,
  enabled = true,
) {
  return useQuery({
    queryKey: adminPaymentKeys.transaction(transactionID),
    queryFn: () => getAdminPaymentByTransactionIDClient(transactionID),
    enabled: enabled && transactionID.length > 0,
  });
}
