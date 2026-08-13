/** Admin projection of GET /admin/loyalty/programme (PH-040d). */

export interface LoyaltyProgrammeTier {
  id: string;
  min_lifetime_points: number;
}

export interface LoyaltyProgramme {
  config_source: "env" | string;
  editable: boolean;
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
