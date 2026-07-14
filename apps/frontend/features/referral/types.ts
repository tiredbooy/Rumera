/** Required, non-null payload returned by GET /referrals/me. */
export interface Referral {
  code: string;
  pending: number;
  completed: number;
  reward: number;
}

/** Required payload accepted by POST /referrals/claim. */
export interface ClaimReferralInput {
  code: string;
}
