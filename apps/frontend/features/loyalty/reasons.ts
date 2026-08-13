import type { LoyaltyTransactionReason } from "./types";

/** Persian labels for ledger reasons (PH-040c). */
export const LOYALTY_REASON_FA: Record<LoyaltyTransactionReason, string> = {
  order_paid: "امتیاز خرید",
  signup: "هدیهٔ عضویت",
  redeem: "بازخرید به کیف پول",
  redeem_reversal: "بازگشت پس از خطای بازخرید",
  referral: "پاداش معرفی دوستان",
  referral_welcome: "هدیهٔ ورود با کد معرفی",
  review: "امتیاز ثبت نظر",
  birthday: "هدیهٔ تولد",
  admin_adjust: "تنظیم توسط پشتیبانی",
  order_clawback: "برگشت امتیاز پس از استرداد",
};

export function loyaltyReasonLabel(reason: string): string {
  if (reason in LOYALTY_REASON_FA) {
    return LOYALTY_REASON_FA[reason as LoyaltyTransactionReason];
  }
  return reason;
}

/**
 * Default review bonus for transparent UX copy only.
 * Must stay aligned with backend LOYALTY_REVIEW_BONUS default (50).
 * Do not treat as a live config API.
 */
export const DEFAULT_REVIEW_BONUS_POINTS = 50;
