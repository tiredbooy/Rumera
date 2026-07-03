// types/loyalty.ts

// ------------------------------------------------
// Enums / string unions
// ------------------------------------------------

export type LoyaltyTier = "bronze" | "silver" | "gold" | "cellar";

// ------------------------------------------------
// Response types
// ------------------------------------------------

// Full loyalty account info (used for the user’s dashboard)
export interface LoyaltyResponse {
  points_balance: number;
  lifetime_points: number;
  tier: LoyaltyTier;
  next_tier?: string; // empty when at top tier
  points_to_next: number;
}

// A single loyalty transaction history entry
export interface LoyaltyTransactionResponse {
  delta: number; // positive = earned, negative = spent
  reason: string; // e.g. "order_placed", "redeemed"
  created_at: string; // ISO datetime
}

// Optional: if you need the raw account data for admin (not directly exposed)
export interface LoyaltyAccount {
  user_id: number;
  points_balance: number;
  lifetime_points: number;
  tier: LoyaltyTier;
  tier_since: string; // ISO datetime
  updated_at: string; // ISO datetime
}

// Optional: if you need transaction details
export interface LoyaltyTransaction {
  id: number;
  user_id: number;
  delta: number;
  reason: string;
  ref_type: string; // e.g. "order", "adjustment"
  ref_id: string; // ID as string
  created_at: string; // ISO datetime
}

// ------------------------------------------------
// Request payloads
// ------------------------------------------------

export interface RedeemPointsReq {
  points: number; // must be >= 1
}

// ------------------------------------------------
// Helper: get tier from lifetime points (optional)
// ------------------------------------------------

export function getTierFor(lifetime: number): LoyaltyTier {
  if (lifetime >= 20000) return "cellar";
  if (lifetime >= 5000) return "gold";
  if (lifetime >= 1000) return "silver";
  return "bronze";
}
