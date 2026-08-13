import { buildQuery } from "@/lib/api/qs";
import { storeRequest } from "@/lib/api/store-client";
import type { ApiSuccess, Paginated } from "@/lib/api/types";

import type {
  Wallet,
  WalletTopUpInput,
  WalletTopUpIntent,
  WalletTransaction,
  WalletTransactionQuery,
  WithdrawWalletInput,
} from "./types";

export function getWallet(): Promise<Wallet> {
  return storeRequest<ApiSuccess<Wallet>>("wallet").then((body) => body.data);
}

export function listWalletTransactions(
  query: WalletTransactionQuery = {},
): Promise<Paginated<WalletTransaction>> {
  return storeRequest<Paginated<WalletTransaction>>(
    `wallet/transactions${buildQuery({ ...query })}`,
  );
}

/** Stable client key for top-up intent (HTTP + domain idempotency, PH-041). */
export function newWalletIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `wtop-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * Starts a gateway top-up. Does NOT credit the wallet — balance updates after
 * payment webhook success.
 */
export function createWalletTopUp(
  input: WalletTopUpInput,
  idempotencyKey?: string,
): Promise<WalletTopUpIntent> {
  const key = (idempotencyKey ?? newWalletIdempotencyKey()).trim();
  return storeRequest<ApiSuccess<WalletTopUpIntent>>("wallet/topup", {
    method: "POST",
    headers: key ? { "Idempotency-Key": key } : undefined,
    body: JSON.stringify(input),
  }).then((body) => body.data);
}

/** @deprecated Self-service withdraw is 410 Gone — do not surface in UI. */
export function withdrawFromWallet(
  input: WithdrawWalletInput,
): Promise<WalletTransaction> {
  return storeRequest<ApiSuccess<WalletTransaction>>("wallet/withdraw", {
    method: "POST",
    body: JSON.stringify(input),
  }).then((body) => body.data);
}
