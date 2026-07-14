import type { PaymentTransactionListQuery } from "./types";

export const adminPaymentKeys = {
  all: ["admin", "payments"] as const,
  list: (query: PaymentTransactionListQuery = {}) =>
    ["admin", "payments", "list", query] as const,
  detail: (id: number) => ["admin", "payments", "detail", id] as const,
  transaction: (transactionID: string) =>
    ["admin", "payments", "transaction", transactionID] as const,
};
