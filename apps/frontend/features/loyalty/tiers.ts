import type { LoyaltyTier } from "./types";

export const LOYALTY_TIER_IDS = [
  "bronze",
  "silver",
  "gold",
  "cellar",
] as const satisfies readonly LoyaltyTier[];

export const LOYALTY_TIER_FA: Record<LoyaltyTier, string> = {
  bronze: "برنزی",
  silver: "نقره‌ای",
  gold: "طلایی",
  cellar: "سرداب",
};

export function loyaltyTierLabel(tier: string): string {
  if (tier in LOYALTY_TIER_FA) {
    return LOYALTY_TIER_FA[tier as LoyaltyTier];
  }
  return tier;
}
