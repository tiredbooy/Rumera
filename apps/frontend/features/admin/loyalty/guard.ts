import "server-only";

import { redirect } from "next/navigation";

import type { UserProfile } from "@/features/profile/types";
import { apiFetch } from "@/lib/api/client";
import { resolveLivePermissions } from "@/lib/rbac/live-permissions";
import { PERMISSIONS } from "@/lib/rbac/permissions";

import { getLoyaltyProgramme } from "./api/server";

/** Where a closed section sends the operator: the only screen that reopens it. */
export const LOYALTY_PROGRAMME_HREF = "/admin/loyalty/programme";

/**
 * The L-2 kill switch as a predicate, for surfaces that hide rather than
 * redirect (the embeddable customer widget, L-5).
 *
 * A programme read that fails reads as ON: the backend stays the authority —
 * it already skips every earn path and 409s redeem/adjust while the switch is
 * off — and a flaky GET must not silently erase a customer's standing.
 */
export async function isLoyaltyEnabled(): Promise<boolean> {
  try {
    return (await getLoyaltyProgramme()).enabled;
  } catch {
    return true;
  }
}

/**
 * L-2 kill switch, enforced once for the whole section. `enabled=false` already
 * skips every earn path and 409s redeem/adjust on the backend; this stops the
 * member list and the ledger being reachable too, so switching the programme
 * off closes the section instead of leaving a live browse-and-mint surface.
 *
 * The programme page itself is deliberately not guarded — it is how the switch
 * goes back on. A programme read that fails leaves the section open: the
 * backend stays the authority, and a flaky GET must not lock operators out.
 */
export async function requireLoyaltyEnabled(): Promise<void> {
  if (!(await isLoyaltyEnabled())) redirect(LOYALTY_PROGRAMME_HREF);
}

/**
 * `loyalty:adjust` for the operator on this request (L-8), read from the live
 * capability matrix rather than taken as a prop.
 *
 * The embeddable widget resolves its own mint gate so a host screen only ever
 * passes an id — the customer file must not have to know that minting points
 * is a separate grant from `customers:write`. Fails closed: an unreadable role
 * or matrix hides the control, and the backend rejects the POST regardless.
 */
export async function canAdjustLoyalty(): Promise<boolean> {
  try {
    const me = await apiFetch<UserProfile>("/auth/me");
    const permissions = await resolveLivePermissions(me.role);
    return permissions.includes(PERMISSIONS.LOYALTY_ADJUST);
  } catch {
    return false;
  }
}
