import { storeRequest } from "@/lib/api/store-client";
import type { ApiSuccess } from "@/lib/api/types";

import type { GiftCardRedemption, RedeemGiftCardInput } from "../types";

export function redeemGiftCard(
  input: RedeemGiftCardInput,
): Promise<GiftCardRedemption> {
  return storeRequest<ApiSuccess<GiftCardRedemption>>("gift-cards/redeem", {
    method: "POST",
    body: JSON.stringify(input),
  }).then((body) => body.data);
}
