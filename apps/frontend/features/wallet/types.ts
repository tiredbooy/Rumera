import type { PaginationQuery } from "@/lib/api/types";

export type WalletTransactionType =
  | "deposit"
  | "withdraw"
  | "purchase"
  | "refund";

export type WalletTransactionStatus =
  | "pending"
  | "completed"
  | "failed"
  | "cancelled";

export interface Wallet {
  id: number;
  balance: string;
  created_at: string;
  updated_at: string;
}

export interface WalletTransaction {
  id: number;
  amount: string;
  type: WalletTransactionType;
  status: WalletTransactionStatus;
  balance_before?: string;
  balance_after?: string;
  reference_order_id?: number;
  description?: string;
  created_at: string;
}

export interface WithdrawWalletInput {
  amount: number;
  description?: string | null;
}

export type WalletTransactionSortField = "created_at" | "amount";

export type WalletTransactionQuery = PaginationQuery & {
  type?: WalletTransactionType;
  status?: WalletTransactionStatus;
  sortBy?: WalletTransactionSortField;
  orderBy?: "asc" | "desc";
};

const CREDIT_TYPES: ReadonlySet<WalletTransactionType> = new Set([
  "deposit",
  "refund",
]);

export function isCreditTransaction(
  transaction: Pick<WalletTransaction, "type">,
): boolean {
  return CREDIT_TYPES.has(transaction.type);
}
