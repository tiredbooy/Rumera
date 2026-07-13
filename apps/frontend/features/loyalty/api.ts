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

export function redeemLoyaltyPoints(
  input: RedeemPointsInput,
): Promise<LoyaltyAccount> {
  return storeRequest<ApiSuccess<LoyaltyAccount>>("loyalty/redeem", {
    method: "POST",
    body: JSON.stringify(input),
  }).then((body) => body.data);
}
