import type {
  LoyaltyNextTier,
  LoyaltyTier,
  LoyaltyTransactionReason,
} from "@/features/loyalty/types";
import type { PaginationQuery } from "@/lib/api/types";

/** Admin projection of GET /admin/loyalty/programme (PH-040d). */

export interface LoyaltyProgrammeTier {
  id: string;
  min_lifetime_points: number;
}

export interface LoyaltyProgramme {
  /** "db" once the programme row exists; "env" only on the seed fallback. */
  config_source: "db" | "env" | string;
  editable: boolean;
  /**
   * The programme kill switch. Earn paths skip silently when false; redeem and
   * admin adjust return 409 LOYALTY_DISABLED.
   */
  enabled: boolean;
  earn_divisor: number;
  redeem_value: number;
  signup_bonus: number;
  review_bonus: number;
  birthday_bonus: number;
  birthday_tz: string;
  referral_reward: number;
  tiers: LoyaltyProgrammeTier[];
  runbook: string;
}

/**
 * Body for PUT /admin/loyalty/programme. A FULL replace — every field is
 * required, and `enabled` in particular is validated as required server-side,
 * so omitting it is a 422 rather than a silent disable. Round-trip the current
 * value even when the editor does not expose a control for it.
 */
export interface UpdateLoyaltyProgrammeInput {
  enabled: boolean;
  earn_divisor: number;
  redeem_value: number;
  signup_bonus: number;
  review_bonus: number;
  birthday_bonus: number;
  birthday_tz: string;
  referral_reward: number;
  tiers: LoyaltyProgrammeTier[];
}

/** Admin list row from GET /admin/loyalty/members (PR-003d). */
export interface LoyaltyMember {
  user_id: string;
  email: string;
  display_name?: string;
  points_balance: number;
  lifetime_points: number;
  tier: LoyaltyTier;
  updated_at: string;
}

/** Admin account from GET /admin/loyalty/members/:userID. */
export interface LoyaltyMemberAccount extends LoyaltyMember {
  next_tier?: LoyaltyNextTier;
  points_to_next: number;
}

/** Staff ledger row — same fields as the customer ledger (id / ref_*). */
export interface LoyaltyMemberTransaction {
  id: number;
  delta: number;
  reason: LoyaltyTransactionReason | string;
  ref_type: string;
  ref_id: string;
  created_at: string;
}

export type LoyaltyMemberSort =
  | "newest"
  | "oldest"
  | "balance_desc"
  | "balance_asc"
  | "tier_desc"
  | "tier_asc";

export interface LoyaltyMemberListQuery extends PaginationQuery {
  q?: string;
  tier?: LoyaltyTier;
  sortBy?: "updated_at" | "points_balance" | "lifetime_points" | "tier";
  orderBy?: "asc" | "desc";
}

export interface LoyaltyMemberLedgerQuery extends PaginationQuery {
  reason?: string;
}

export type LoyaltyMemberSearchParams = {
  q?: string | string[];
  tier?: string | string[];
  sort?: string | string[];
  page?: string | string[];
};

export type LoyaltyMemberDetailSearchParams = {
  page?: string | string[];
  reason?: string | string[];
};

export type LoyaltyLedgerFilters = {
  page: number;
  reason?: string;
};

export type LoyaltyMemberFilters = {
  query: string;
  page: number;
  tier?: LoyaltyTier;
  sort: LoyaltyMemberSort;
};

/** POST /admin/users/:userID/loyalty/adjust result (PR-003e). */
export interface LoyaltyAdjustResult {
  user_id: string;
  points_balance: number;
  lifetime_points: number;
  tier: LoyaltyTier;
  next_tier?: LoyaltyNextTier;
  points_to_next: number;
  delta: number;
  note?: string;
  actor_user_id: string;
  idempotency_key: string;
  ref_type: string;
  ref_id: string;
  replayed: boolean;
  reason: string;
}
