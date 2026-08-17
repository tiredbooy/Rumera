import { faNum } from "@/lib/products";

import type { LoyaltyMember } from "./types";

export {
  LOYALTY_TIER_FA,
  LOYALTY_TIER_IDS,
  loyaltyTierLabel,
} from "@/features/loyalty/tiers";

export function memberDisplayName(
  member: Pick<LoyaltyMember, "display_name" | "email" | "user_id">,
): string {
  const name = member.display_name?.trim();
  return name || member.email || member.user_id;
}

export function signedPoints(delta: number): string {
  if (delta > 0) return `+${faNum(delta)}`;
  if (delta < 0) return `−${faNum(Math.abs(delta))}`;
  return faNum(0);
}