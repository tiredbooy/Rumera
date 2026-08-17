/** True when GET /loyalty supplied a usable Toman-per-point rate. */
export function hasRedeemRate(
  redeemValue: number | null | undefined,
): redeemValue is number {
  return redeemValue != null && Number.isFinite(redeemValue) && redeemValue > 0;
}

/**
 * Wallet Toman for a redeem preview (`points * redeem_value`).
 * Returns null when points or the live rate are missing/invalid —
 * callers must not invent 1000.
 */
export function redeemPreviewToman(
  points: number,
  redeemValue: number | null | undefined,
): number | null {
  if (!Number.isFinite(points) || points <= 0) {
    return null;
  }
  if (!hasRedeemRate(redeemValue)) {
    return null;
  }
  return points * redeemValue;
}
