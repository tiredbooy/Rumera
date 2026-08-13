import { storeRequest } from "@/lib/api/store-client";
import type { ApiSuccess } from "@/lib/api/types";

import type {
  GiftCardPurchaseIntent,
  GiftCardRedemption,
  PurchaseGiftCardInput,
  PurchasedGiftCard,
  RedeemGiftCardInput,
} from "../types";

/** Stable client key for purchase/redeem intents (HTTP money idempotency). */
export function newGiftCardIdempotencyKey(prefix = "gc"): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * Starts a gateway gift-card purchase. Does NOT issue a code —
 * code appears on GET /gift-cards/mine after payment webhook success.
 */
export function purchaseGiftCard(
  input: PurchaseGiftCardInput,
  idempotencyKey?: string,
): Promise<GiftCardPurchaseIntent> {
  const key = (idempotencyKey ?? newGiftCardIdempotencyKey("gbuy")).trim();
  return storeRequest<ApiSuccess<GiftCardPurchaseIntent>>(
    "gift-cards/purchase",
    {
      method: "POST",
      headers: key ? { "Idempotency-Key": key } : undefined,
      body: JSON.stringify(input),
    },
  ).then((body) => body.data);
}

/** Codes the signed-in customer paid for (self-delivery after purchase). */
export function listMyGiftCards(): Promise<PurchasedGiftCard[]> {
  return storeRequest<ApiSuccess<PurchasedGiftCard[]>>("gift-cards/mine").then(
    (body) => body.data ?? [],
  );
}

export function redeemGiftCard(
  input: RedeemGiftCardInput,
  idempotencyKey?: string,
): Promise<GiftCardRedemption> {
  const key = (idempotencyKey ?? newGiftCardIdempotencyKey("gcr")).trim();
  return storeRequest<ApiSuccess<GiftCardRedemption>>("gift-cards/redeem", {
    method: "POST",
    headers: key ? { "Idempotency-Key": key } : undefined,
    body: JSON.stringify(input),
  }).then((body) => body.data);
}
