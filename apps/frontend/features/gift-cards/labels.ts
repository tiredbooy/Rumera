import type { GiftCardStatus } from "./types";

/** One wording per gift-card status — holder and admin see the same record. */
export const GIFT_CARD_STATUS_FA: Record<GiftCardStatus, string> = {
  active: "فعال",
  redeemed: "استفاده‌شده",
  disabled: "باطل‌شده",
};
