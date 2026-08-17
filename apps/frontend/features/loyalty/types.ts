export type LoyaltyTier = "bronze" | "silver" | "gold" | "cellar";

export type LoyaltyNextTier = Exclude<LoyaltyTier, "bronze">;

export type LoyaltyTransactionReason =
  | "order_paid"
  | "signup"
  | "redeem"
  | "redeem_reversal"
  | "referral"
  | "referral_welcome"
  | "review"
  | "birthday"
  | "admin_adjust"
  | "order_clawback";

/** Customer-facing projection returned by GET /api/v1/loyalty. */
export interface LoyaltyAccount {
  points_balance: number;
  lifetime_points: number;
  tier: LoyaltyTier;
  next_tier?: LoyaltyNextTier;
  points_to_next: number;
  /** Toman of wallet credit per point (programme rate, PR-003l). */
  redeem_value?: number;
}

/** Ledger row from GET /api/v1/loyalty/transactions (PR-003j). */
export interface LoyaltyTransaction {
  id?: number;
  delta: number;
  reason: LoyaltyTransactionReason;
  ref_type?: string;
  ref_id?: string;
  created_at: string;
}

/** Positive integer payload accepted by POST /api/v1/loyalty/redeem. */
export interface RedeemPointsInput {
  points: number;
}
