import { storeRequest } from "@/lib/api/store-client";
import type { ApiSuccess } from "@/lib/api/types";

import type {
  LoyaltyAccount,
  LoyaltyTransaction,
  RedeemPointsInput,
} from "./types";

export function getLoyaltyAccount(): Promise<LoyaltyAccount> {
  return storeRequest<ApiSuccess<LoyaltyAccount>>("loyalty").then(
    (body) => body.data,
  );
}

export function listLoyaltyTransactions(): Promise<LoyaltyTransaction[]> {
  return storeRequest<ApiSuccess<LoyaltyTransaction[]>>(
    "loyalty/transactions",
  ).then((body) => body.data);
}

/** Stable client key for redeem (HTTP + domain spend idempotency, PH-040b/c). */
export function newLoyaltyIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `loy-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

export function redeemLoyaltyPoints(
  input: RedeemPointsInput,
  idempotencyKey?: string,
): Promise<LoyaltyAccount> {
  const key = (idempotencyKey ?? newLoyaltyIdempotencyKey()).trim();
  return storeRequest<ApiSuccess<LoyaltyAccount>>("loyalty/redeem", {
    method: "POST",
    headers: key ? { "Idempotency-Key": key } : undefined,
    body: JSON.stringify(input),
  }).then((body) => body.data);
}
