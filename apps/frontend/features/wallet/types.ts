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

/** POST /wallet/topup request (gateway-funded; not free deposit). */
export interface WalletTopUpInput {
  amount: number;
}

/** Pending gateway intent from POST /wallet/topup. */
export interface WalletTopUpIntent {
  payment_id: number;
  transaction_id: string;
  amount: string;
  currency: string;
  status: string;
  /** Absolute gateway start URL from the API. Empty when env is unset. */
  payment_url?: string;
}

/**
 * Non-empty API `payment_url` only. Never invent a start URL from
 * `transaction_id` or a default host.
 */
export function usablePaymentUrl(
  url?: string | null,
): string | undefined {
  const trimmed = typeof url === "string" ? url.trim() : "";
  return trimmed ? trimmed : undefined;
}

/** Amount bounds aligned with backend Min/MaxWalletTopUpAmount (IRT). */
export const WALLET_TOPUP_MIN = 10_000;
export const WALLET_TOPUP_MAX = 50_000_000;

/** Storefront presets (Toman). */
export const WALLET_TOPUP_PRESETS = [
  50_000, 100_000, 250_000, 500_000, 1_000_000,
] as const;

export function isValidTopUpAmount(amount: number): boolean {
  return (
    Number.isFinite(amount) &&
    amount >= WALLET_TOPUP_MIN &&
    amount <= WALLET_TOPUP_MAX
  );
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
